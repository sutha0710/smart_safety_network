// Service Worker for PWA offline functionality
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('shieldher-v1').then((cache) => {
      return cache.addAll([
        '/app.html',
        '/manifest.json',
        // Add other assets
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});