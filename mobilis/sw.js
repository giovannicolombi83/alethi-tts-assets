// Mobilis in Mobili: funziona anche offline. Cambiare VERSION a ogni aggiornamento.
const VERSION = 'mim-v7';
const FILES = ['./', 'index.html', 'style.css', 'cards.js', 'engine.js', 'ai.js', 'app.js', 'manifest.webmanifest', "img/ARONNAX.jpg","img/CONSEIL.jpg","img/EGO.jpg","img/NED.jpg","img/aid.jpg","img/apple-touch-icon.png","img/back.jpg","img/bulb.png","img/equilibrium.jpg","img/gem.png","img/icon-192.png","img/icon-512.png","img/icon-maskable.png","img/m0.jpg","img/m1.jpg","img/m10.jpg","img/m11.jpg","img/m12.jpg","img/m13.jpg","img/m14.jpg","img/m15.jpg","img/m16.jpg","img/m17.jpg","img/m18.jpg","img/m19.jpg","img/m2.jpg","img/m20.jpg","img/m21.jpg","img/m22.jpg","img/m23.jpg","img/m24.jpg","img/m25.jpg","img/m26.jpg","img/m27.jpg","img/m28.jpg","img/m29.jpg","img/m3.jpg","img/m30.jpg","img/m31.jpg","img/m32.jpg","img/m33.jpg","img/m34.jpg","img/m35.jpg","img/m36.jpg","img/m37.jpg","img/m38.jpg","img/m39.jpg","img/m4.jpg","img/m40.jpg","img/m41.jpg","img/m5.jpg","img/m6.jpg","img/m7.jpg","img/m8.jpg","img/m9.jpg","img/maelstrom.jpg","img/mind.png","img/nautcard.jpg","img/nautilus.jpg","img/nemesis.jpg","img/sub.png","img/warship.png","img/wreck.png"];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
