const CACHE_NAME = 'menapp-shell-v4';
const SHELL_URLS = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

/**
 * Nunca debe interceptar el flujo de login (código de un solo uso), llamadas a la IA, ni
 * ningún request cross-origin (Supabase REST/auth). Cachear una respuesta de Supabase la
 * deja servida para siempre sin ir a la red — si una lectura llegó a devolver vacío por
 * cualquier motivo transitorio, el pull-sync la toma como "se borró en remoto" y pisa datos
 * reales (metas, menú de la semana) en cada carga futura, sin importar qué arregle el código.
 */
function bypassesCache(url) {
  return url.origin !== self.location.origin || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Menapp', body: '' };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    data.body = event.data ? event.data.text() : '';
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Menapp', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('/hoy');
    })
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
