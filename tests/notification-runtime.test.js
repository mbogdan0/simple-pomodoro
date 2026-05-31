import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNotificationRuntime } from '../src/app/alerts/notification-runtime.js';

const originalNavigator = globalThis.navigator;
const originalNotification = globalThis.Notification;
const originalWindow = globalThis.window;

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

describe('notification runtime', () => {
  afterEach(() => {
    setNavigator(originalNavigator);
    setWindow(originalWindow);
    globalThis.Notification = originalNotification;
    vi.restoreAllMocks();
  });

  it('reports unsupported when Notification API and service worker are unavailable', () => {
    setWindow({});
    setNavigator({});
    globalThis.Notification = undefined;
    const runtime = createNotificationRuntime({
      ensureServiceWorkerRegistration: async () => null
    });

    expect(runtime.getNotificationSupportModel()).toEqual({
      hasNotificationApi: false,
      hasServiceWorker: false,
      permissionState: 'unsupported',
      unsupported: true
    });
  });

  it('sends via window Notification when permission is granted', async () => {
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
    const runtime = createNotificationRuntime({
      ensureServiceWorkerRegistration: async () => null
    });

    const result = await runtime.sendNotificationWithFallback(
      {
        body: 'Notification check finished.',
        silent: true,
        tag: 'check-tag',
        title: 'Notification test'
      },
      {
        serviceWorkerReady: false
      }
    );

    expect(result).toBe(true);
    expect(sent).toEqual([
      {
        options: {
          body: 'Notification check finished.',
          silent: true,
          tag: 'check-tag'
        },
        title: 'Notification test'
      }
    ]);
  });

  it('falls back to service worker channel when window Notification throws', async () => {
    function ThrowingNotification() {
      throw new Error('Notification constructor failed');
    }
    ThrowingNotification.permission = 'granted';
    ThrowingNotification.requestPermission = vi.fn(async () => 'granted');

    setWindow({
      Notification: ThrowingNotification
    });
    setNavigator({
      serviceWorker: {}
    });
    globalThis.Notification = ThrowingNotification;
    const worker = {
      postMessage(_message, ports) {
        ports[0].postMessage({ ok: true });
      }
    };
    const runtime = createNotificationRuntime({
      ensureServiceWorkerRegistration: async () => ({
        active: worker
      })
    });

    const result = await runtime.sendNotificationWithFallback(
      {
        body: 'Fallback body',
        silent: true,
        tag: 'fallback-tag',
        title: 'Fallback title'
      },
      {
        serviceWorkerReady: true
      }
    );

    expect(result).toBe(true);
  });

  it('returns unsupported permission state when Notification API is missing', async () => {
    setWindow({});
    setNavigator({});
    globalThis.Notification = undefined;
    const runtime = createNotificationRuntime({
      ensureServiceWorkerRegistration: async () => null
    });

    await expect(runtime.requestNotificationPermission()).resolves.toBe('unsupported');
  });
});
