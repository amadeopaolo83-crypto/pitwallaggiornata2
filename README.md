# PitComm — comunicazione box/auto per endurance

## Struttura
- `server/` — server Node.js + Socket.io. Un unico processo gestisce tutti i team: ogni codice inserito nell'app è una "stanza" separata.
- `client/` — PWA (HTML/CSS/JS puro, nessun build necessario): pagina di scelta box/auto, vista auto, vista box.

## Avvio server
```
cd server
npm install
npm start
```
Il server ascolta sulla porta 3000 (modificabile con la variabile d'ambiente `PORT`). Va deployato su un host raggiungibile da internet (una VPS, Render, Railway, Fly.io, ecc.) perché sia raggiungibile sia dai telefoni del box sia dal telefono in auto.

## Avvio client
La cartella `client/` è un sito statico: si può caricare su qualunque hosting statico (Netlify, Vercel, GitHub Pages, o lo stesso server Node con un piccolo static file server). Aprendo `index.html` dal telefono, al primo avvio va inserito l'indirizzo del server nel campo "Server" nella pagina iniziale (si salva automaticamente per le volte successive).

Per installarla come app: aprire il sito nel browser (Chrome su Android) e usare "Aggiungi a schermata Home" — da lì si comporta come un'app a schermo intero.

## Cosa manca ancora — live timing
Il modulo che estrae i distacchi da un sito di timing di terzi non è collegato: ogni provider (Alkamel, MyLaps, RaceControl, sito dell'organizzatore, ecc.) ha una struttura diversa, quindi serve sapere quale userete per scrivere il parser corretto (o verificare se espone un'API pubblica, molto più stabile dello scraping HTML).

Nel frattempo la funzione è già utilizzabile: nella vista box c'è un campo per inserire manualmente posizione e distacco, che arriva subito all'auto. Quando saprete il sito esatto, si aggiunge un piccolo servizio che legge quella pagina e chiama automaticamente lo stesso evento (`timingUpdate`) già cablato lato server e client — non serve toccare il resto dell'app.

## Note tecniche
- **Consumo carburante**: inserito manualmente dal box con uno slider; la barra in auto cambia colore automaticamente dal verde al rosso in base alla percentuale.
- **Pulsanti rapidi auto**: i 4 pulsanti (default: Box, Rifornimento, Pilota, Ripeti) sono modificabili — testo e colore — dalla vista box, sezione "Pulsanti rapidi auto".
- **Messaggi a schermo intero**: nella vista box si possono creare più preset (testo, colore, durata) e inviarli con un tap; in auto compaiono a schermo intero e il testo viene letto ad alta voce.
- **Blocco orizzontale + schermo sempre acceso**: gestiti automaticamente all'ingresso nella vista auto (Fullscreen API, Screen Orientation API, Wake Lock API). Se il browser non permette il blocco orientamento in automatico, compare un avviso "ruota il telefono".
- **Codice team**: nessuna password, funziona come una "stanza" — chiunque conosca il codice può collegarsi. Se in futuro serve più sicurezza, si aggiunge un PIN o un controllo lato server, senza cambiare la struttura.
