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
    tag: '',
    renotify: true,
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
    (async () => {
      const clientList = await (self as any).clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Check if the user is already looking at the app
      for (const client of clientList) {
        // Mobile browsers often rely on visibilityState rather than strict focus
        if (client.focused || client.visibilityState === 'visible') {
          // App is actively on screen. Don't show OS notification.
          return;
        }
      }

      // App is not focused, show the OS notification
      const notificationTag =
        typeof data.tag === 'string' && data.tag.trim().length > 0
          ? data.tag
          : `genjutsu-${Date.now()}`;

      let notificationBody = data.body;
      let history: string[] = [];

      // For whispers, keep a rolling message history in the same card.
      if (notificationTag.startsWith('whisper-')) {
        const existing = await (self as any).registration.getNotifications({
          tag: notificationTag,
        });
        const previous = existing?.[0];

        const previousHistory = Array.isArray(previous?.data?.history)
          ? previous.data.history.filter((line: unknown): line is string => typeof line === 'string')
          : typeof previous?.body === 'string' && previous.body.trim().length > 0
            ? previous.body.split('\n')
            : [];

        const incoming =
          typeof data.body === 'string' && data.body.trim().length > 0 ? data.body.trim() : '';

        history = [...previousHistory, incoming].filter((line) => line.length > 0).slice(-6);
        notificationBody = history.join('\n');
      }

      return (self as any).registration.showNotification(data.title, {
        body: notificationBody,
        icon: data.icon,
        badge: 'https://genjutsu-social.vercel.app/badge-96x96.png',
        tag: notificationTag,
        renotify: Boolean(data.renotify),
        data: { url: data.url, history },
      });
    })()
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
