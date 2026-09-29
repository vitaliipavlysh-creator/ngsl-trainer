// Обробка Web Push-нагадувань. Підключається до згенерованого service worker через importScripts.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'NGSL Trainer';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Час повторити слова.',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'daily-reminder',
      renotify: true,
      data: { url: data.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (open) return open.focus();
      return self.clients.openWindow(url);
    }),
  );
});
