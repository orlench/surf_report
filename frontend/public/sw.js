/* eslint-disable no-restricted-globals */

// Service worker for push notifications

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Surf Alert', body: event.data.text() };
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo192.png',
    badge: '/logo192.png',
    tag: payload.data?.url ? `surf-${payload.data.url}` : 'surf-alert',
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Check conditions' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Surf Alert', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to focus an existing tab
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(self.location.origin + url);
          return client.focus();
        }
      }
      // Open new tab
      return self.clients.openWindow(self.location.origin + url);
    })
  );
});
