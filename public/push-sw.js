// Web Push for E-CFunds (computers + iPhone Home Screen app). Loaded into the app's service worker via
// workbox importScripts (vite.config.ts). The push Edge Function sends { title, body, link, kind, id }.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'E-CFunds', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'E-CFunds', {
    body: d.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: d.id ? `ecf-${d.id}` : undefined,
    data: { link: d.link || '/' },
  }));
});

// Tap → bring an open E-CFunds window forward on that page, or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        if ('navigate' in w) { try { await w.navigate(url); } catch { /* cross-state; ignore */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
