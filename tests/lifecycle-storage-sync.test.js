import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLifecycleStorageSync } from '../src/app/runtime/lifecycle-storage-sync.js';
import { STORAGE_KEYS } from '../src/core/constants.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession, startCurrentStep } from '../src/core/session.js';
import { createMemoryStorage, saveSettings } from '../src/core/storage.js';

const originalLocalStorage = globalThis.localStorage;

function setLocalStorage(value) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value
  });
}

describe('lifecycle storage sync', () => {
  afterEach(() => {
    setLocalStorage(originalLocalStorage);
    vi.restoreAllMocks();
  });

  it('commits synced idle session after settings storage update', () => {
    const storage = createMemoryStorage();
    saveSettings(
      {
        ...createDefaultSettings(),
        repeatCount: 2
      },
      storage
    );
    setLocalStorage(storage);

    const state = {
      activeSession: createInitialSession(createDefaultSettings()),
      settings: createDefaultSettings()
    };
    const commitSession = vi.fn();
    const renderApp = vi.fn();
    const restoreSessionFromStorage = vi.fn();
    const syncIdleReminder = vi.fn();
    const syncWorkerNow = vi.fn();
    const lifecycleStorageSync = createLifecycleStorageSync({
      commitSession,
      renderApp,
      restoreSessionFromStorage,
      state,
      syncIdleReminder,
      syncWorkerNow
    });

    lifecycleStorageSync.handleStorageSyncEvent({
      key: STORAGE_KEYS.settings
    });

    expect(state.settings.repeatCount).toBe(2);
    expect(syncIdleReminder).toHaveBeenCalledTimes(1);
    expect(commitSession).toHaveBeenCalledTimes(1);
    expect(renderApp).not.toHaveBeenCalled();
  });

  it('refreshes UI instead of committing session while timer is active', () => {
    const storage = createMemoryStorage();
    saveSettings(
      {
        ...createDefaultSettings(),
        repeatCount: 3
      },
      storage
    );
    setLocalStorage(storage);

    const state = {
      activeSession: startCurrentStep(createInitialSession(createDefaultSettings()), 1_000),
      settings: createDefaultSettings()
    };
    const commitSession = vi.fn();
    const renderApp = vi.fn();
    const lifecycleStorageSync = createLifecycleStorageSync({
      commitSession,
      renderApp,
      restoreSessionFromStorage: vi.fn(),
      state,
      syncIdleReminder: vi.fn(),
      syncWorkerNow: vi.fn()
    });

    lifecycleStorageSync.handleStorageSyncEvent({
      key: STORAGE_KEYS.settings
    });

    expect(state.settings.repeatCount).toBe(3);
    expect(commitSession).not.toHaveBeenCalled();
    expect(renderApp).toHaveBeenCalledTimes(1);
  });

  it('restores active session from storage and resyncs worker', () => {
    const state = {
      activeSession: createInitialSession(createDefaultSettings()),
      settings: createDefaultSettings()
    };
    const restoreSessionFromStorage = vi.fn();
    const syncWorkerNow = vi.fn();
    const lifecycleStorageSync = createLifecycleStorageSync({
      commitSession: vi.fn(),
      renderApp: vi.fn(),
      restoreSessionFromStorage,
      state,
      syncIdleReminder: vi.fn(),
      syncWorkerNow
    });

    lifecycleStorageSync.handleStorageSyncEvent({
      key: STORAGE_KEYS.activeSession
    });

    expect(restoreSessionFromStorage).toHaveBeenCalledWith({
      persist: false
    });
    expect(syncWorkerNow).toHaveBeenCalledTimes(1);
  });
});
