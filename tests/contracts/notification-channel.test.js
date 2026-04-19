import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNotificationService } from '../../src/app/alerts/notification-service.js';

const originalWindow = globalThis.window;
const originalNavigator = globalThis.navigator;
const originalNotification = globalThis.Notification;

function setNavigator(value) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value
  });
}

function setWindow(value) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value
  });
}

function createState() {
  return {
    alertSettings: {},
    lastFocusMinuteReminderKey: '',
    notificationNotice: '',
    ntfyNotice: '',
    serviceWorkerReady: false,
    settings: {
      alertSettings: {
        notificationsEnabled: true,
        soundEnabled: true
      },
      autoStartNextStep: false,
      ntfyPublishUrl: ''
    }
  };
}

describe('notification service contracts', () => {
  afterEach(() => {
    setWindow(originalWindow);
    setNavigator(originalNavigator);
    globalThis.Notification = originalNotification;
    vi.restoreAllMocks();
  });

  it('uses window Notification channel when permission is granted', async () => {
    const sent = [];
    function MockNotification(title, options) {
      sent.push({ options, title });
    }
    MockNotification.permission = 'granted';
    MockNotification.requestPermission = vi.fn(async () => 'granted');

    setWindow({
      Notification: MockNotification
    });
    setNavigator({});
    globalThis.Notification = MockNotification;

    const state = createState();
    const notificationService = createNotificationService({
      ensureServiceWorkerRegistration: async () => null,
      playCompletionTone: () => true,
      state
    });

    await notificationService.testNotification();

    expect(state.notificationNotice).toBe('Test notification was sent.');
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe('Notification test');
    expect(sent[0].options.body).toBe('Notification channel check finished.');
  });

  it('falls back to service worker channel when Notification API is unavailable', async () => {
    setWindow({});
    setNavigator({
      serviceWorker: {}
    });
    globalThis.Notification = undefined;

    const worker = {
      postMessage(_message, ports) {
        ports[0].postMessage({ ok: true });
      }
    };
    const state = createState();
    const notificationService = createNotificationService({
      ensureServiceWorkerRegistration: async () => ({
        active: worker
      }),
      playCompletionTone: () => true,
      state
    });

    await notificationService.testNotification();

    expect(state.notificationNotice).toBe('Test notification was sent.');
  });

  it('uses waiting service worker when active worker is unavailable', async () => {
    setWindow({});
    setNavigator({
      serviceWorker: {}
    });
    globalThis.Notification = undefined;

    const worker = {
      postMessage(_message, ports) {
        ports[0].postMessage({ ok: true });
      }
    };
    const state = createState();
    const notificationService = createNotificationService({
      ensureServiceWorkerRegistration: async () => ({
        active: null,
        waiting: worker
      }),
      playCompletionTone: () => true,
      state
    });

    const sent = await notificationService.sendNotificationWithFallback({
      body: 'Body',
      silent: true,
      tag: 'tag',
      title: 'Title'
    });

    expect(sent).toBe(true);
  });

  it('reports unsupported permission flow when Notification API is missing', async () => {
    setWindow({});
    setNavigator({});
    globalThis.Notification = undefined;

    const state = createState();
    const notificationService = createNotificationService({
      ensureServiceWorkerRegistration: async () => null,
      playCompletionTone: () => true,
      state
    });

    await notificationService.requestNotificationPermission();

    expect(state.notificationNotice).toBe('Notifications are not supported in this browser.');
  });
});
