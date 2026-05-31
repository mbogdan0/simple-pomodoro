const DEFAULT_SERVICE_WORKER_URL = 'service-worker.js';

function canUseServiceWorker({
  globalRef = globalThis,
  navigatorRef = globalThis.navigator,
  windowRef = globalThis.window
}) {
  const isDevelopmentRuntime = Boolean(globalRef['__APP_DEV__']);
  const serviceWorkerSupported = Boolean(navigatorRef && 'serviceWorker' in navigatorRef);
  const isSecureContext = Boolean(windowRef?.isSecureContext);

  return !isDevelopmentRuntime && serviceWorkerSupported && isSecureContext;
}

export function createServiceWorkerRuntime({
  state,
  globalRef = globalThis,
  navigatorRef = globalThis.navigator,
  serviceWorkerUrl = DEFAULT_SERVICE_WORKER_URL,
  windowRef = globalThis.window
}) {
  let serviceWorkerRegistration = null;

  async function registerServiceWorker() {
    if (!canUseServiceWorker({ globalRef, navigatorRef, windowRef })) {
      return;
    }

    try {
      await navigatorRef.serviceWorker.register(serviceWorkerUrl);
      serviceWorkerRegistration = await navigatorRef.serviceWorker.ready;
      state.serviceWorkerReady = true;
    } catch {
      state.serviceWorkerReady = false;
    }
  }

  async function ensureServiceWorkerRegistration() {
    if (serviceWorkerRegistration) {
      return serviceWorkerRegistration;
    }

    if (!canUseServiceWorker({ globalRef, navigatorRef, windowRef })) {
      return null;
    }

    try {
      serviceWorkerRegistration = await navigatorRef.serviceWorker.ready;
      state.serviceWorkerReady = true;
      return serviceWorkerRegistration;
    } catch {
      state.serviceWorkerReady = false;
      return null;
    }
  }

  return {
    ensureServiceWorkerRegistration,
    registerServiceWorker
  };
}
