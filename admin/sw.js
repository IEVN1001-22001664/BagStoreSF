/* BAG STORE SF — Service worker del panel (alcance /admin/).
   Estrategia "red primero": siempre se intenta la versión publicada y la copia guardada solo se usa
   sin conexión. Así un despliegue nuevo nunca queda escondido detrás de una caché vieja.
   Nunca intercepta Supabase (datos, sesión y fotos van siempre directo a la red). */
'use strict';

const VERSION = 'panel-v1';
const SHELL = [
  './',
  'admin.css',
  'api.js',
  'images.js',
  'admin.js',
  'editor.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  '../assets/css/styles.css',
  '../assets/js/config.js',
  '../assets/img/brand/logo.webp',
];

const SHELL_URLS = new Set(SHELL.map((p) => new URL(p, self.location).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Google Fonts: directo a la red
  // Solo la estructura del panel; las fotos del catálogo no se guardan (crecerían sin límite)
  if (req.mode !== 'navigate' && !SHELL_URLS.has(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok && res.type === 'basic') cache.put(req.mode === 'navigate' ? './' : req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      throw err;
    }
  })());
});
