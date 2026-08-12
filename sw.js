/* Pol Tracker service worker — lets the app open offline (view-only).
   Strategy: network-first for the app's own files (so you always get the
   latest version when online), falling back to the cached copy when offline.
   Supabase API calls are cross-origin and are never touched here, so live
   data always goes straight to the network. */

const CACHE = 'pol-tracker-v139';
const SHELL = [
  './',
  './index.html',
  './app.js?v=139',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle this app's own files. Anything cross-origin (Supabase data,
  // CDN scripts, web fonts) goes to the network as usual — never cached here.
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(req);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const idx = await cache.match('./index.html', { ignoreSearch: true });
        if (idx) return idx;
      }
      throw err;
    }
  })());
});
