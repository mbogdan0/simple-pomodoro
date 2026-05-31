import { selectNotificationChannel } from '../../core/alerts.js';

const SERVICE_WORKER_RESPONSE_TIMEOUT_MS = 1_000;

function getGlobalNotificationConstructor() {
  return globalThis.Notification;
}

function hasWindowNotificationApi(windowRef = globalThis.window) {
  return typeof windowRef?.Notification === 'function';
}

function hasNavigatorServiceWorker(navigatorRef = globalThis.navigator) {
  return Boolean(navigatorRef && 'serviceWorker' in navigatorRef);
}

function resolveNotificationPermissionState({ hasNotificationApi, notificationConstructor }) {
  if (!hasNotificationApi) {
    return 'unsupported';
  }

  return notificationConstructor?.permission ?? 'default';
}

export function createNotificationRuntime({ ensureServiceWorkerRegistration }) {
  function getNotificationSupportModel() {
    const notificationConstructor = getGlobalNotificationConstructor();
    const hasNotificationApi = hasWindowNotificationApi();
    const hasServiceWorker = hasNavigatorServiceWorker();
    const permissionState = resolveNotificationPermissionState({
      hasNotificationApi,
      notificationConstructor
    });

    return {
      hasNotificationApi,
      hasServiceWorker,
      permissionState,
      unsupported: !hasNotificationApi && !hasServiceWorker
    };
  }

  async function sendNotificationViaServiceWorker(payload) {
    const registration = await ensureServiceWorkerRegistration();

    if (!registration) {
      return false;
    }

    const worker = registration.active ?? registration.waiting ?? registration.installing;

    if (!worker || typeof MessageChannel !== 'function') {
      return false;
    }

    try {
      const channel = new MessageChannel();
      const responsePromise = new Promise((resolve) => {
        const timeoutId = setTimeout(() => resolve(false), SERVICE_WORKER_RESPONSE_TIMEOUT_MS);

        channel.port1.onmessage = (event) => {
          clearTimeout(timeoutId);
          resolve(Boolean(event.data?.ok));
        };
      });

      worker.postMessage(
        {
          payload,
          type: 'SHOW_NOTIFICATION'
        },
        [channel.port2]
      );

      return await responsePromise;
    } catch {
      return false;
    }
  }

  async function sendNotificationWithFallback(payload, { serviceWorkerReady = false } = {}) {
    const notificationSupport = getNotificationSupportModel();
    const channel = selectNotificationChannel({
      hasNotificationApi: notificationSupport.hasNotificationApi,
      hasServiceWorker: serviceWorkerReady || notificationSupport.hasServiceWorker,
      notificationPermission: notificationSupport.permissionState
    });

    if (channel === 'window') {
      try {
        const NotificationConstructor = getGlobalNotificationConstructor();
        new NotificationConstructor(payload.title, {
          body: payload.body,
          silent: payload.silent,
          tag: payload.tag
        });
        return true;
      } catch {
        return sendNotificationViaServiceWorker(payload);
      }
    }

    if (channel === 'service-worker') {
      return sendNotificationViaServiceWorker(payload);
    }

    return false;
  }

  function requestNotificationPermission() {
    if (!hasWindowNotificationApi()) {
      return Promise.resolve('unsupported');
    }

    const NotificationConstructor = getGlobalNotificationConstructor();
    return NotificationConstructor.requestPermission();
  }

  return {
    getNotificationSupportModel,
    requestNotificationPermission,
    sendNotificationWithFallback
  };
}
