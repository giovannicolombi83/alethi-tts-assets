// Alethi: funziona anche offline. Cambiare VERSION a ogni aggiornamento.
const VERSION = 'alethi-v3';
const FILES = ['./', 'index.html', 'style.css', 'engine.js', 'ai.js', 'app.js', 'manifest.webmanifest', "img/abissale.png","img/anim_blue.png","img/anim_purple.png","img/anim_red.png","img/anim_yellow.png","img/apple-touch-icon.png","img/back.jpg","img/bridge.png","img/bridge4.png","img/c0.jpg","img/c1.jpg","img/c10.jpg","img/c11.jpg","img/c12.jpg","img/c13.jpg","img/c14.jpg","img/c15.jpg","img/c16.jpg","img/c17.jpg","img/c18.jpg","img/c19.jpg","img/c2.jpg","img/c3.jpg","img/c4.jpg","img/c5.jpg","img/c6.jpg","img/c7.jpg","img/c8.jpg","img/c9.jpg","img/crystal.png","img/disc_blue.png","img/disc_purple.png","img/disc_red.png","img/disc_yellow.png","img/heart.png","img/icon-192.png","img/icon-512.png","img/icon-maskable.png","img/node_1.png","img/node_2.png","img/node_3.png","img/node_4.png","img/node_5.png","img/node_6.png","img/parshendi.png","img/plateau_1.jpg","img/plateau_2.jpg","img/plateau_3.jpg","img/plateau_4.jpg","img/plateau_5.jpg","img/plateau_6.jpg","img/shield.png","img/war_blue.png","img/war_purple.png","img/war_red.png","img/war_yellow.png"];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // rete prima (per ricevere gli aggiornamenti), copia salvata se offline
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
