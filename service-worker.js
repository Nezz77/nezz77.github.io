const CACHE_NAME = 'nh-portfolio-cache-v3';
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
  './logos/moratuwa.png',
  './logos/ijse.png',
  './logos/richmond.png',
  './liquid-glass.js',
  // Event photography albums
  './events/1.jpeg',
  './events/2.jpeg',
  './events/3.jpeg',
  './events/4.jpeg',
  './events/5.jpeg',
  './events/6.jpeg',
  './events/7.jpeg',
  './events/8.jpeg',
  './events/9.jpeg',
  './events/10.jpeg',
  './events/11.jpeg',
  './events/12.jpeg',
  './events/13.jpeg',
  './events/14.jpeg',
  './events/15.jpeg',
  './events/16.jpeg',
  './events/17.jpeg',
  './events/18.jpeg',
  './events/19.jpeg',
  './events/20.jpeg',
  './events/21.jpeg',
  './events/22.jpeg',
  './events/23.jpeg',
  './events/24.jpeg',
  './events/25.jpeg'
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

// Fetch Event - Network-First for HTML/navigation, Cache-First/Stale-While-Revalidate for other assets
self.addEventListener('fetch', (event) => {
  // Check if this is a navigation request or requesting HTML
  const isHtmlRequest =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isHtmlRequest) {
    // Network-First Strategy for HTML files
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline, serve from cache
          return caches.match(event.request);
        })
    );
  } else {
    // Stale-While-Revalidate Strategy for other assets (CSS, JS, images, fonts)
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
  }
});
