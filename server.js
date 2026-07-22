// PitComm - server di comunicazione box <-> auto per gare endurance
// Ogni "team" è una stanza Socket.io identificata dal codice inserito nell'app.
// Il server è deliberatamente semplice e stateless-per-riavvio: tiene solo
// in memoria l'ultimo stato utile (config pulsanti, consumo, ecc.) così un
// dispositivo che si riconnette a metà gara riceve subito lo stato corrente.

const { Server } = require("socket.io");
const http = require("http");

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer((req, res) => {
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
      timing: null, // { gap: "+1.2s", position: 3, updatedAt }
      lastFlash: null,
    });
  }
  return rooms.get(code);
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

  // AUTO -> BOX: pressione di uno dei 4 pulsanti rapidi
  socket.on("quickMessage", ({ buttonId, label }) => {
    if (!joinedCode) return;
    io.to(joinedCode).emit("quickMessageReceived", {
      buttonId,
      label,
      at: Date.now(),
    });
  });

  // BOX -> AUTO: messaggio a comparsa (testo, colore, durata) + lettura vocale
  socket.on("flashMessage", ({ text, color, durationSeconds }) => {
    if (!joinedCode) return;
    const state = getRoomState(joinedCode);
    state.lastFlash = { text, color, durationSeconds, at: Date.now() };
    io.to(joinedCode).emit("flashMessage", state.lastFlash);
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

  // BOX -> AUTO: distacchi dal live timing (inseriti manualmente per ora)
  socket.on("timingUpdate", ({ gap, position, note }) => {
    if (!joinedCode) return;
    const state = getRoomState(joinedCode);
    state.timing = { gap, position, note, updatedAt: Date.now() };
    io.to(joinedCode).emit("timingUpdate", state.timing);
  });

  socket.on("disconnect", () => {
    // nessuna pulizia particolare: lo stato della stanza resta per i reconnect
  });
});

httpServer.listen(PORT, () => {
  console.log(`PitComm server in ascolto sulla porta ${PORT}`);
});
