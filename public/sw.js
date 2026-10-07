const CACHE_NAME = 'menapp-shell-v3';
const SHELL_URLS = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

/** Nunca debe interceptar el flujo de login (código de un solo uso) ni llamadas a la IA. */
function bypassesCache(url) {
  return url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Las navegaciones (documentos HTML) nunca se interceptan: el middleware de auth
  // responde con redirects, y Safari rechaza de plano una respuesta de SW con
  // `redirected: true` para una navegación ("response served by a service worker
  // has redirections"), tirando abajo la carga de la página entera.
  if (event.request.mode === 'navigate') return;
  if (bypassesCache(new URL(event.request.url))) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
