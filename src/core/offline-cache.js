export const OFFLINE_CACHE_PREFIX = 'timer-offline-';
export const OFFLINE_CACHE_NAME = `${OFFLINE_CACHE_PREFIX}v1`;

const SHELL_PATHS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './timer-worker.js'
];

export function isNavigationRequest(request) {
  return request?.mode === 'navigate';
}

export function isCacheableRequest(request, origin) {
  if (!request || request.method !== 'GET') {
    return false;
  }

  try {
    const requestUrl = new URL(request.url);
    return requestUrl.origin === origin;
  } catch {
    return false;
  }
}

export function resolveShellUrls(scope) {
  const scopeUrl = new URL(scope);
  return SHELL_PATHS.map((path) => new URL(path, scopeUrl).toString());
}

export function resolveIndexUrl(scope) {
  return resolveShellUrls(scope)[1];
}
