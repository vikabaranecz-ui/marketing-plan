const CACHE_NAME = 'marketing-plan-v2';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/marketing-plan-192.png',
  '/icons/marketing-plan-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('/'))),
  );
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Marketing Plan', body: event.data?.text() || 'Нове нагадування' };
  }

  const title = data.title || 'Marketing Plan';
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: data.body || 'Час виконати заплановане',
      icon: '/icons/marketing-plan-192.png',
      badge: '/icons/marketing-plan-192.png',
      tag: data.tag || 'marketing-plan-reminder',
      data: { url: data.url || '/' },
      timestamp: data.timestamp || Date.now(),
      renotify: true,
      silent: false,
      vibrate: [200, 80, 200],
    }),
    'setAppBadge' in self.navigator ? self.navigator.setAppBadge(1) : Promise.resolve(),
  ]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existingClient = clients.find(client => client.url.startsWith(self.location.origin));
      if (existingClient) {
        void existingClient.navigate(targetUrl);
        return existingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
