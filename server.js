// PitComm - server di comunicazione box <-> auto per gare endurance
// Ogni "team" è una stanza Socket.io identificata dal codice inserito nell'app.
// Il server è deliberatamente semplice e stateless-per-riavvio: tiene solo
// in memoria l'ultimo stato utile (config pulsanti, consumo, ecc.) così un
// dispositivo che si riconnette a metà gara riceve subito lo stato corrente.

const { Server } = require("socket.io");
const http = require("http");
const webpush = require("web-push");

const PORT = process.env.PORT || 3000;

// Chiavi VAPID per le notifiche push: impostale come variabili d'ambiente
// su Render (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). Il fallback qui sotto
// funziona subito ma è meglio spostarlo su env var in produzione.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BDL1U-RB9YWSWMNoB6_u7gjFrMAlIYkD4hkDFt_ZaauQw8k3OVCTYxfzsHaFSNDaDOSRPxToO3Va4lWbCzNK00M";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "1Gzw3jN-k4GS-SYzXWiJqvGH5j4cie9-gVBjvOIL7tI";
webpush.setVapidDetails("mailto:pitcomm@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const httpServer = http.createServer((req, res) => {
  if (req.url === "/vapid-public-key") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(VAPID_PUBLIC_KEY);
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("PitComm server attivo\n");
});

const io = new Server(httpServer, {
  cors: { origin: "*" }, // in produzione: restringere all'origine del client
});

// Stato in memoria per ogni codice team: { fuel, autonomyMinutes, dayMode,
// quickButtons, timing, lastFlash }
const rooms = new Map();

function getRoomState(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      fuel: { percent: 100, updatedAt: Date.now() },
      autonomyMinutes: 60,
      dayMode: true,
      quickButtons: [
        { id: 1, label: "Box", color: "#3fa9f5" },
        { id: 2, label: "Rifornimento", color: "#f5a623" },
        { id: 3, label: "Pilota", color: "#7ed321" },
        { id: 4, label: "Ripeti", color: "#bd10e0" },
      ],
      timing: null, // { position, gapAhead, gapBehind, updatedAt }
      lastFlash: null,
      pushSubscriptions: [],
      fuelSystem: {
        tankCapacityLiters: 100,
        currentLiters: 100,
        consumptionRatePerHour: null,
        onTrack: false,
        sessionStartAt: null,
        sessionStartLiters: 0,
      },
    });
  }
  return rooms.get(code);
}

function notifyBoxDevices(code, label) {
  const state = getRoomState(code);
  const payload = JSON.stringify({
    title: "Messaggio dall'auto",
    body: label,
  });
  state.pushSubscriptions = state.pushSubscriptions.filter((sub) => {
    webpush.sendNotification(sub, payload).catch((err) => {
      // 404/410 = sottoscrizione non più valida (browser disinstallato, permesso revocato, ecc.)
      if (err.statusCode === 404 || err.statusCode === 410) return false;
    });
    return true; // rimozione effettiva gestita al prossimo giro se serve
  });
}

io.on("connection", (socket) => {
  let joinedCode = null;
  let joinedRole = null; // "box" | "auto"

  socket.on("join", ({ code, role }, ack) => {
    if (!code || !role) return ack && ack({ ok: false, error: "codice o ruolo mancante" });
    joinedCode = String(code).trim().toUpperCase();
    joinedRole = role;
    socket.join(joinedCode);
    socket.data.role = role;

    const state = getRoomState(joinedCode);
    ack && ack({ ok: true, state });
  });

  // BOX -> server: registra la sottoscrizione push di questo dispositivo
  socket.on("registerPush", ({ subscription }) => {
    if (!joinedCode || !subscription) return;
    const state = getRoomState(joinedCode);
    const exists = state.pushSubscriptions.some((s) => s.endpoint === subscription.endpoint);
    if (!exists) state.pushSubscriptions.push(subscription);
  });

  // AUTO -> BOX: pressione di uno dei 4 pulsanti rapidi
  socket.on("quickMessage", ({ buttonId, label }) => {
    if (!joinedCode) return;
    io.to(joinedCode).emit("quickMessageReceived", {
      buttonId,
      label,
      at: Date.now(),
    });
    notifyBoxDevices(joinedCode, label);
  });

  // BOX -> AUTO: messaggio a comparsa (testo, colore, durata) + lettura vocale
  socket.on("flashMessage", ({ text, color, durationSeconds }) => {
    if (!joinedCode) return;
    const state = getRoomState(joinedCode);
    state.lastFlash = { text, color, durationSeconds, at: Date.now() };
    io.to(joinedCode).emit("flashMessage", state.lastFlash);
  });

  // BOX -> tutti i box: sincronizza capienza, litri, consumo, stato in pista/ai box
  socket.on("fuelSystemUpdate", (fuelSystem) => {
    if (!joinedCode) return;
    const state = getRoomState(joinedCode);
    state.fuelSystem = fuelSystem;
    io.to(joinedCode).emit("fuelSystemUpdate", state.fuelSystem);
  });

  // BOX -> AUTO: aggiornamento consumo carburante (percentuale 0-100)
  socket.on("fuelUpdate", ({ percent }) => {
    if (!joinedCode) return;
    const state = getRoomState(joinedCode);
    state.fuel = { percent, updatedAt: Date.now() };
    io.to(joinedCode).emit("fuelUpdate", state.fuel);
  });

  // BOX -> AUTO: tempo di autonomia stimato (per previsione sosta)
  socket.on("autonomyUpdate", ({ minutes }) => {
    if (!joinedCode) return;
    const state = getRoomState(joinedCode);
    state.autonomyMinutes = minutes;
    io.to(joinedCode).emit("autonomyUpdate", { minutes });
  });

  // BOX -> AUTO: modalità giorno/notte
  socket.on("dayModeUpdate", ({ dayMode }) => {
    if (!joinedCode) return;
    const state = getRoomState(joinedCode);
    state.dayMode = dayMode;
    io.to(joinedCode).emit("dayModeUpdate", { dayMode });
  });

  // BOX -> AUTO: configurazione dei 4 pulsanti rapidi (testo + colore)
  socket.on("quickButtonsUpdate", ({ buttons }) => {
    if (!joinedCode) return;
    const state = getRoomState(joinedCode);
    state.quickButtons = buttons;
    io.to(joinedCode).emit("quickButtonsUpdate", { buttons });
  });

  // BOX -> AUTO: distacchi dal live timing (posizione, distacco davanti, distacco dietro)
  socket.on("timingUpdate", ({ position, gapAhead, gapBehind }) => {
    if (!joinedCode) return;
    const state = getRoomState(joinedCode);
    state.timing = { position, gapAhead, gapBehind, updatedAt: Date.now() };
    io.to(joinedCode).emit("timingUpdate", state.timing);
  });

  socket.on("disconnect", () => {
    // nessuna pulizia particolare: lo stato della stanza resta per i reconnect
  });
});

httpServer.listen(PORT, () => {
  console.log(`PitComm server in ascolto sulla porta ${PORT}`);
});
