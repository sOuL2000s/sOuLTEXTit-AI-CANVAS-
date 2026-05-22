// Minimal Service Worker for PWA Installability
// This satisfies browser requirements without implementing caching logic.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    })
  );
  self.clients.claim();
});

// A fetch handler is MANDATORY for the browser to trigger the PWA install prompt.
// This pass-through listener satisfies the requirement while doing nothing.
self.addEventListener('fetch', (event) => {
  // Simply allow requests to proceed to the network
});