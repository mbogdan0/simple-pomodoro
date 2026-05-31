import { describe, expect, it, vi } from 'vitest';

import { createServiceWorkerRuntime } from '../src/app/runtime/service-worker-runtime.js';

describe('service worker runtime', () => {
  it('skips registration in development runtime', async () => {
    const state = {
      serviceWorkerReady: false
    };
    const navigatorRef = {
      serviceWorker: {
        ready: Promise.resolve({}),
        register: vi.fn(async () => {})
      }
    };
    const runtime = createServiceWorkerRuntime({
      globalRef: { __APP_DEV__: true },
      navigatorRef,
      state,
      windowRef: { isSecureContext: true }
    });

    await runtime.registerServiceWorker();

    expect(navigatorRef.serviceWorker.register).not.toHaveBeenCalled();
    expect(state.serviceWorkerReady).toBe(false);
  });

  it('registers service worker and keeps ready registration available', async () => {
    const registration = {
      scope: '/app/'
    };
    const state = {
      serviceWorkerReady: false
    };
    const navigatorRef = {
      serviceWorker: {
        ready: Promise.resolve(registration),
        register: vi.fn(async () => {})
      }
    };
    const runtime = createServiceWorkerRuntime({
      globalRef: {},
      navigatorRef,
      state,
      windowRef: { isSecureContext: true }
    });

    await runtime.registerServiceWorker();
    const ensured = await runtime.ensureServiceWorkerRegistration();

    expect(navigatorRef.serviceWorker.register).toHaveBeenCalledWith('service-worker.js');
    expect(ensured).toBe(registration);
    expect(state.serviceWorkerReady).toBe(true);
  });

  it('returns null when ready registration fails', async () => {
    const state = {
      serviceWorkerReady: true
    };
    const navigatorRef = {
      serviceWorker: {
        ready: Promise.reject(new Error('ready failed')),
        register: vi.fn(async () => {})
      }
    };
    const runtime = createServiceWorkerRuntime({
      globalRef: {},
      navigatorRef,
      state,
      windowRef: { isSecureContext: true }
    });

    const ensured = await runtime.ensureServiceWorkerRegistration();

    expect(ensured).toBeNull();
    expect(state.serviceWorkerReady).toBe(false);
  });
});
