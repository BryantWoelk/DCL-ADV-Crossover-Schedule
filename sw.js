// Bump BUILD_ID on every rebuild so the browser detects a byte-diff in this file
// and runs the standard service-worker update flow (install -> waiting -> banner).
const BUILD_ID = 'v3-2026-08-18T00-00-00-r2';
const CACHE_NAME = 'a1b-lighting-' + BUILD_ID;

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './shared.js',
  './app.js',
  './data.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Cache-first, with a background revalidate that refreshes the cache for next time.
// The page itself decides when to surface an update (via the standard SW lifecycle
// events above), so this never mutates what's on screen out from under Bryant.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
