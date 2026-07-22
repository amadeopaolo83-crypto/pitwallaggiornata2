// Service worker minimo: rende l'app installabile.
// Non fa caching aggressivo perché l'app dipende da una connessione
// real-time (WebSocket) sempre attiva: niente contenuti offline "falsi".
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', () => {}); // passthrough
