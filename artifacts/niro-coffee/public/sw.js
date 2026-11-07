const IS_DEVELOPMENT_HOST =
  self.location.hostname.endsWith('.replit.dev') ||
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

if (IS_DEVELOPMENT_HOST) {
  self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('noir-coffee-'))
            .map((cacheName) => caches.delete(cacheName)),
        );

        await self.registration.unregister();
      })(),
    );
  });
} else {
const CACHE_NAME = 'noir-coffee-shell-v4';
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
          return cachePromise
            .then((cache) => cache.put(APP_ROOT, response.clone()))
            .catch(() => undefined)
            .then(() => response);
        }
        return response;
      })
      .catch(() => null);

    event.waitUntil(updatePromise.then(() => undefined));
    event.respondWith(
      updatePromise.then((response) =>
        response?.ok
          ? response
          : cachedPromise.then((cached) => cached || response || Response.error()),
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
}
