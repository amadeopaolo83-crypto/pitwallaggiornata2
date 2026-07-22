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

## Notifiche push (nuovo)
Quando dal box è aperta la pagina, alla prima apertura il browser chiede il permesso di inviare notifiche: bisogna toccare **Consenti**. Da quel momento, ogni messaggio inviato dall'auto arriva come notifica del telefono — **anche a schermo spento o con l'app in background** — su tutti i telefoni del box che hanno dato il permesso, con vibrazione. Se l'app è aperta in primo piano, invece del banner di sistema si sente anche un breve beep.

Limiti da sapere:
- **Android (Chrome)**: funziona bene, anche a schermo spento, finché il telefono ha batteria e connessione.
- **iPhone (Safari)**: le notifiche push funzionano solo se l'app è stata installata con "Aggiungi a Home" (non nel semplice browser) e serve iOS 16.4 o superiore. È comunque meno affidabile di Android in background.
- Il permesso notifiche va dato **per ogni telefono** che userete come box: se sostituite un telefono o cancellate i dati del browser, va rifatto.

Le chiavi di sicurezza per le notifiche (VAPID) sono già incluse nel codice per farlo funzionare subito. Per maggiore sicurezza in futuro si possono spostare come variabili d'ambiente su Render (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) invece che nel codice — non è obbligatorio per far funzionare tutto.

## Timer di consumo carburante (nuovo)
Nella vista box, sotto ad "Autonomia", c'è ora:
- **Durata pieno (min)**: quanti minuti dura un pieno di carburante
- **Avvia consumo**: la barra in auto comincia a scendere da sola, in tempo reale
- **Pausa**: ferma la discesa automatica al valore attuale
- **Rifornito (100%)**: da usare dopo ogni pit-stop, riporta il livello al massimo e ferma il timer

Muovere manualmente lo slider del carburante mette automaticamente in pausa il conteggio, per evitare che i due si contraddicano.


- **Consumo carburante**: inserito manualmente dal box con uno slider; la barra in auto cambia colore automaticamente dal verde al rosso in base alla percentuale.
- **Pulsanti rapidi auto**: i 4 pulsanti (default: Box, Rifornimento, Pilota, Ripeti) sono modificabili — testo e colore — dalla vista box, sezione "Pulsanti rapidi auto".
- **Messaggi a schermo intero**: nella vista box si possono creare più preset (testo, colore, durata) e inviarli con un tap; in auto compaiono a schermo intero e il testo viene letto ad alta voce.
- **Blocco orizzontale + schermo sempre acceso**: gestiti automaticamente all'ingresso nella vista auto (Fullscreen API, Screen Orientation API, Wake Lock API). Se il browser non permette il blocco orientamento in automatico, compare un avviso "ruota il telefono".
- **Codice team**: nessuna password, funziona come una "stanza" — chiunque conosca il codice può collegarsi. Se in futuro serve più sicurezza, si aggiunge un PIN o un controllo lato server, senza cambiare la struttura.
