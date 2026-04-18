const RECENT_TAG_TTL_MS = 30_000;
const recentlyDeliveredTags = new Map();

function cleanupRecentTags(now = Date.now()) {
  for (const [tag, deliveredAt] of recentlyDeliveredTags.entries()) {
    if (now - deliveredAt > RECENT_TAG_TTL_MS) {
      recentlyDeliveredTags.delete(tag);
    }
  }
}

async function showNotificationWithDedup(payload = {}) {
  const {
    body = '',
    silent = false,
    tag = 'timer-update',
    title = 'Timer'
  } = payload;
  const now = Date.now();

  cleanupRecentTags(now);

  if (recentlyDeliveredTags.has(tag)) {
    return { deduped: true, ok: true };
  }

  const existing = await self.registration.getNotifications({ tag });

  if (existing.length > 0) {
    recentlyDeliveredTags.set(tag, now);
    return { deduped: true, ok: true };
  }

  await self.registration.showNotification(title, {
    body,
    renotify: false,
    silent,
    tag
  });

  recentlyDeliveredTags.set(tag, now);
  return { deduped: false, ok: true };
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const { data, ports } = event;

  if (!data || data.type !== 'SHOW_NOTIFICATION') {
    return;
  }

  const replyPort = ports && ports[0];

  event.waitUntil(
    showNotificationWithDedup(data.payload)
      .then((result) => {
        if (replyPort) {
          replyPort.postMessage(result);
        }
      })
      .catch((error) => {
        if (replyPort) {
          replyPort.postMessage({
            error: error instanceof Error ? error.message : String(error),
            ok: false
          });
        }
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
});
