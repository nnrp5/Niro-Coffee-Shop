const CACHE_NAME = 'noir-coffee-shell-v1';
const APP_ROOT = new URL('./', self.registration.scope).href;
const PRECACHE_URLS = [
  APP_ROOT,
  new URL('manifest.webmanifest', self.registration.scope).href,
  new URL('pwa-192.png', self.registration.scope).href,
  new URL('pwa-512.png', self.registration.scope).href,
];
const DEVELOPMENT_PATH = /\/(?:src|node_modules)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('noir-coffee-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('/sw.js') ||
    url.pathname.startsWith('/@') ||
    DEVELOPMENT_PATH.test(url.pathname)
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    const cachePromise = caches.open(CACHE_NAME);
    const cachedPromise = cachePromise.then((cache) => cache.match(APP_ROOT));
    const updatePromise = fetch(request)
      .then((response) => {
        if (response.ok) {
          return cachePromise.then((cache) => {
            cache.put(APP_ROOT, response.clone());
            return response;
          });
        }
        return response;
      })
      .catch(() => null);

    event.waitUntil(updatePromise.then(() => undefined));
    event.respondWith(
      cachedPromise.then((cached) =>
        cached || updatePromise.then((response) => response || Response.error()),
      ),
    );
    return;
  }

  if (
    url.pathname.includes('/assets/') &&
    /\.(?:js|css|svg|png|jpe?g|webp|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (!response.ok) return response;
            return cache.put(request, response.clone()).then(() => response);
          });
        }),
      ),
    );
  }
});
