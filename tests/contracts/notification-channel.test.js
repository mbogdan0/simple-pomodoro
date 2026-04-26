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

function createState(overrides = {}) {
  const defaultSettings = {
    alertSettings: {
      notificationsEnabled: true,
      soundEnabled: true
    },
    autoStartNextStep: false,
    idleReminderEnabled: false,
    ntfyPublishUrl: ''
  };
  const settings = {
    ...defaultSettings,
    ...overrides.settings,
    alertSettings: {
      ...defaultSettings.alertSettings,
      ...overrides.settings?.alertSettings
    }
  };

  return {
    activeSession: {
      status: 'idle'
    },
    alertSettings: {},
    lastFocusMinuteReminderKey: '',
    lastIdleReminderAt: 0,
    notificationNotice: '',
    ntfyNotice: '',
    serviceWorkerReady: false,
    ...overrides,
    settings
  };
}

function installNotificationMock() {
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

  return sent;
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
    expect(sent[0].title).toBe('Notification test 🧪');
    expect(sent[0].options.body).toBe('Notification check finished.');
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

  it('does not dispatch idle reminders when the setting is disabled', () => {
    const sent = installNotificationMock();
    const playUiActionTone = vi.fn();
    const state = createState({
      settings: {
        idleReminderEnabled: false
      }
    });
    const notificationService = createNotificationService({
      ensureServiceWorkerRegistration: async () => null,
      playCompletionTone: () => true,
      playUiActionTone,
      state
    });

    notificationService.dispatchIdleReminder(60_000);

    expect(playUiActionTone).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('dispatches one idle reminder after the one-minute threshold', () => {
    const sent = installNotificationMock();
    const playUiActionTone = vi.fn();
    const state = createState({
      lastIdleReminderAt: 1_000,
      settings: {
        idleReminderEnabled: true
      }
    });
    const notificationService = createNotificationService({
      ensureServiceWorkerRegistration: async () => null,
      playCompletionTone: () => true,
      playUiActionTone,
      state
    });

    notificationService.maybeDispatchIdleReminder(61_000);

    expect(playUiActionTone).toHaveBeenCalledWith(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe('Timer is idle ⏸');
    expect(state.lastIdleReminderAt).toBe(61_000);
  });

  it('deduplicates an immediate worker idle reminder after the local fallback dispatches', () => {
    const sent = installNotificationMock();
    const playUiActionTone = vi.fn();
    const state = createState({
      settings: {
        idleReminderEnabled: true
      }
    });
    const notificationService = createNotificationService({
      ensureServiceWorkerRegistration: async () => null,
      playCompletionTone: () => true,
      playUiActionTone,
      state
    });

    notificationService.maybeDispatchIdleReminder(60_000);
    notificationService.dispatchIdleReminder(60_001);

    expect(playUiActionTone).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
    expect(state.lastIdleReminderAt).toBe(60_000);
  });

  it.each(['running', 'paused'])('does not dispatch idle reminders while %s', (status) => {
    const sent = installNotificationMock();
    const playUiActionTone = vi.fn();
    const state = createState({
      activeSession: {
        status
      },
      settings: {
        idleReminderEnabled: true
      }
    });
    const notificationService = createNotificationService({
      ensureServiceWorkerRegistration: async () => null,
      playCompletionTone: () => true,
      playUiActionTone,
      state
    });

    notificationService.maybeDispatchIdleReminder(60_000);
    notificationService.dispatchIdleReminder(60_001);

    expect(playUiActionTone).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });
});
