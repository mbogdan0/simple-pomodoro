import {
  buildNotificationTag,
  createCompletionAlertPayload,
  selectNotificationChannel,
  shouldDispatchFocusMinuteReminder
} from '../../core/alerts.js';
import { createNtfyTestPayload, sendNtfyPush } from '../../utils/ntfy.js';

export function createNotificationService({
  state,
  ensureServiceWorkerRegistration,
  playCompletionTone
}) {
  function getNotificationSupportModel() {
    const hasNotificationApi = typeof window.Notification === 'function';
    const hasServiceWorker = 'serviceWorker' in navigator;
    const permissionState = hasNotificationApi ? Notification.permission : 'unsupported';

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

    if (!worker) {
      return false;
    }

    try {
      const channel = new MessageChannel();
      const responsePromise = new Promise((resolve) => {
        const timeoutId = setTimeout(() => resolve(false), 1_000);

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

  async function sendNotificationWithFallback(payload) {
    const notificationSupport = getNotificationSupportModel();
    const channel = selectNotificationChannel({
      hasNotificationApi: notificationSupport.hasNotificationApi,
      hasServiceWorker: state.serviceWorkerReady || notificationSupport.hasServiceWorker,
      notificationPermission: notificationSupport.permissionState
    });

    if (channel === 'window') {
      try {
        new Notification(payload.title, {
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

  function dispatchCompletionAlerts(session, completionKey = '') {
    const completionPayload = createCompletionAlertPayload({
      autoStartNextStep: state.settings.autoStartNextStep,
      session
    });
    const notificationTag = buildNotificationTag('step-complete', completionKey);

    if (navigator.vibrate) {
      navigator.vibrate([120, 80, 180]);
    }

    if (state.settings.alertSettings.soundEnabled) {
      playCompletionTone();
    }

    if (state.settings.alertSettings.notificationsEnabled) {
      void sendNotificationWithFallback({
        body: completionPayload.body,
        silent: !state.settings.alertSettings.soundEnabled,
        tag: notificationTag,
        title: completionPayload.title
      });
    }

    if (state.settings.ntfyPublishUrl) {
      void sendNtfyPush({
        payload: completionPayload,
        publishUrl: state.settings.ntfyPublishUrl
      });
    }
  }

  function maybeDispatchFocusMinuteReminder(session, now = Date.now()) {
    const { key, shouldDispatch } = shouldDispatchFocusMinuteReminder({
      notificationsEnabled: state.settings.alertSettings.notificationsEnabled,
      now,
      previousKey: state.lastFocusMinuteReminderKey,
      session
    });

    if (!shouldDispatch) {
      return;
    }

    state.lastFocusMinuteReminderKey = key;
    void sendNotificationWithFallback({
      body: '1 minute left in this focus session.',
      silent: true,
      tag: buildNotificationTag('focus-minute', key),
      title: 'Focus ending soon'
    });
  }

  function requestNotificationPermission() {
    const notificationSupport = getNotificationSupportModel();

    if (!notificationSupport.hasNotificationApi) {
      state.notificationNotice = 'Notifications are not supported in this browser.';
      return Promise.resolve(state.notificationNotice);
    }

    return Notification.requestPermission().then((permission) => {
      state.notificationNotice = permission === 'granted'
        ? 'Notifications are now allowed.'
        : 'Notification permission was not granted.';
      return state.notificationNotice;
    });
  }

  async function testNotification() {
    const notificationSupport = getNotificationSupportModel();

    if (notificationSupport.unsupported) {
      state.notificationNotice = 'Notifications are not supported in this browser.';
      return state.notificationNotice;
    }

    const sent = await sendNotificationWithFallback({
      body: 'Notification channel check finished.',
      silent: !state.settings.alertSettings.soundEnabled,
      tag: buildNotificationTag('test-notification', String(Date.now())),
      title: 'Notification test'
    });

    state.notificationNotice = sent
      ? 'Test notification was sent.'
      : 'Unable to send a test notification.';
    return state.notificationNotice;
  }

  async function testNtfy() {
    if (!state.settings.ntfyPublishUrl) {
      state.ntfyNotice = 'Set a valid ntfy publish URL first.';
      return state.ntfyNotice;
    }

    const sent = await sendNtfyPush({
      payload: createNtfyTestPayload(),
      publishUrl: state.settings.ntfyPublishUrl
    });

    state.ntfyNotice = sent
      ? 'ntfy test push was sent.'
      : 'Unable to send ntfy test push.';
    return state.ntfyNotice;
  }

  return {
    dispatchCompletionAlerts,
    getNotificationSupportModel,
    maybeDispatchFocusMinuteReminder,
    requestNotificationPermission,
    sendNotificationWithFallback,
    testNotification,
    testNtfy
  };
}
