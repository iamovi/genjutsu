import { precacheAndRoute } from 'workbox-precaching';

// Workbox precache manifest (injected by vite-plugin-pwa)
precacheAndRoute((self as any).__WB_MANIFEST);

// Claim clients immediately so the SW activates on first install
(self as any).skipWaiting();
(self as any).clients.claim();

// =============================================================================
// Push Notification Handler
// =============================================================================

self.addEventListener('push', (event: any) => {
  let data = {
    title: 'genjutsu',
    body: 'You got a new notification — open app to see',
    icon: 'https://genjutsu-social.vercel.app/icon-192x192.png',
    url: 'https://genjutsu-social.vercel.app',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    // Use defaults if payload parsing fails
  }

  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      // Check if the user is already looking at the app
      for (const client of clientList) {
        // Mobile browsers often rely on visibilityState rather than strict focus
        if (client.focused || client.visibilityState === 'visible') {
          // App is actively on screen. Don't show OS notification.
          return;
        }
      }

      // App is not focused, show the OS notification
      return (self as any).registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon,
        badge: 'https://genjutsu-social.vercel.app/badge-96x96.png',
        tag: `genjutsu-${Date.now()}`,
        renotify: true,
        data: { url: data.url },
      });
    })
  );
});

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || 'https://genjutsu-social.vercel.app';

  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      // If the app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('genjutsu-social.vercel.app') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return (self as any).clients.openWindow(targetUrl);
    })
  );
});
