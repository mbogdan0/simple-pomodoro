import {
  OFFLINE_CACHE_NAME,
  OFFLINE_CACHE_PREFIX,
  isCacheableRequest,
  isNavigationRequest,
  resolveIndexUrl,
  resolveShellUrls
} from './core/offline-cache.js';

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

async function cacheShellResources() {
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const shellUrls = resolveShellUrls(self.registration.scope);

  await Promise.all(
    shellUrls.map((url) => cache.add(url).catch(() => undefined))
  );
}

async function cleanupStaleOfflineCaches() {
  const cacheNames = await caches.keys();
  const staleCacheNames = cacheNames.filter(
    (name) => name.startsWith(OFFLINE_CACHE_PREFIX) && name !== OFFLINE_CACHE_NAME
  );

  await Promise.all(staleCacheNames.map((name) => caches.delete(name)));
}

async function handleNavigationRequest(request) {
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const indexUrl = resolveIndexUrl(self.registration.scope);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await cache.put(indexUrl, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cachedResponse = (await cache.match(request)) ?? (await cache.match(indexUrl));

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response('Offline fallback is unavailable.', {
      headers: {
        'content-type': 'text/plain; charset=utf-8'
      },
      status: 503
    });
  }
}

async function refreshCachedResponse(request) {
  try {
    const networkResponse = await fetch(request);

    if (!networkResponse.ok) {
      return;
    }

    const cache = await caches.open(OFFLINE_CACHE_NAME);
    await cache.put(request, networkResponse.clone());
  } catch {
    // Ignore network failures during stale-while-revalidate refresh.
  }
}

async function handleCacheFirstRequest(request, event) {
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    event.waitUntil(refreshCachedResponse(request));
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    return new Response('', {
      status: 503,
      statusText: 'Offline'
    });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await cacheShellResources();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await cleanupStaleOfflineCaches();
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!isCacheableRequest(request, self.location.origin)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleCacheFirstRequest(request, event));
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
