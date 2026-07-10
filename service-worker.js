const CACHE_NAME = 'nh-portfolio-cache-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './photographynh.html',
  './style.css',
  './logos/nhlogo.png',
  './logos/nhlogo.ico',
  './assets/background.jpg',
  './assets/background2.jpg',
  './assets/my4to.jpg',
  './assets/my4to2.jpg',
  './logos/moraspirit.png',
  './logos/fitmoments.png',
  './logos/sasnakasansada.png',
  './logos/appliedmaths.jpg',
  './liquid-glass.js'
];

// Install Event - Pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Serve from Cache, Fallback to Network & dynamically cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache, and fetch fresh version in the background to update cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* Ignore network errors in background */ });
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Dynamically cache fetched requests (like gallery images or CDN scripts)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (event.request.url.startsWith(self.location.origin) ||
            event.request.url.includes('cdnjs.cloudflare.com') ||
            event.request.url.includes('cdn.jsdelivr.net') ||
            event.request.url.includes('fonts.googleapis.com') ||
            event.request.url.includes('fonts.gstatic.com'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return cachedResponse;
      });
    })
  );
});
