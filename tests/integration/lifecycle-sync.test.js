import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLifecycleSync } from '../../src/app/runtime/lifecycle-sync.js';
import { STORAGE_KEYS } from '../../src/core/constants.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession, startCurrentStep } from '../../src/core/session.js';
import { createMemoryStorage, saveSettings } from '../../src/core/storage.js';

const originalDocument = globalThis.document;
const originalLocalStorage = globalThis.localStorage;
const originalWindow = globalThis.window;

function setDocument(value) {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value
  });
}

function setLocalStorage(value) {
  Object.defineProperty(globalThis, 'localStorage', {
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

function createEventHub() {
  const handlers = {};

  return {
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    fire(type, payload) {
      handlers[type]?.(payload);
    },
    handlers
  };
}

describe('lifecycle sync integration', () => {
  afterEach(() => {
    setDocument(originalDocument);
    setLocalStorage(originalLocalStorage);
    setWindow(originalWindow);
    vi.restoreAllMocks();
  });

  it('re-syncs idle scenario on settings storage changes', () => {
    const storage = createMemoryStorage();
    const nextSettings = {
      ...createDefaultSettings(),
      repeatCount: 2
    };
    saveSettings(nextSettings, storage);
    setLocalStorage(storage);

    const state = {
      activeSession: createInitialSession(createDefaultSettings()),
      settings: createDefaultSettings()
    };
    const commitSession = vi.fn();
    const renderApp = vi.fn();
    const lifecycle = createLifecycleSync({
      commitSession,
      persistSession: vi.fn(),
      reconcileSession: vi.fn(),
      renderApp,
      restoreSessionFromStorage: vi.fn(),
      state,
      syncWorkerNow: vi.fn(),
      updatePageChrome: vi.fn()
    });

    lifecycle.handleStorageSyncEvent({
      key: STORAGE_KEYS.settings
    });

    expect(state.settings.repeatCount).toBe(2);
    expect(commitSession).toHaveBeenCalledTimes(1);
    expect(commitSession).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'idle'
      }),
      {
        dispatchAlerts: false,
        persist: false,
        render: true,
        syncWorker: true
      }
    );
    expect(renderApp).not.toHaveBeenCalled();
  });

  it('re-renders instead of mutating session when settings change mid-run', () => {
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
    const lifecycle = createLifecycleSync({
      commitSession,
      persistSession: vi.fn(),
      reconcileSession: vi.fn(),
      renderApp,
      restoreSessionFromStorage: vi.fn(),
      state,
      syncWorkerNow: vi.fn(),
      updatePageChrome: vi.fn()
    });

    lifecycle.handleStorageSyncEvent({
      key: STORAGE_KEYS.settings
    });

    expect(state.settings.repeatCount).toBe(3);
    expect(commitSession).not.toHaveBeenCalled();
    expect(renderApp).toHaveBeenCalledTimes(1);
  });

  it('binds lifecycle listeners and routes browser events to sync callbacks', () => {
    const documentHub = createEventHub();
    documentHub.hidden = true;
    const windowHub = createEventHub();
    setDocument(documentHub);
    setWindow(windowHub);

    const state = {
      activeSession: startCurrentStep(createInitialSession(createDefaultSettings()), 1_000),
      settings: createDefaultSettings()
    };
    const commitSession = vi.fn();
    const persistSession = vi.fn();
    const reconcileSession = vi.fn();
    const renderApp = vi.fn();
    const restoreSessionFromStorage = vi.fn();
    const syncWorkerNow = vi.fn();
    const updatePageChrome = vi.fn();
    const lifecycle = createLifecycleSync({
      commitSession,
      persistSession,
      reconcileSession,
      renderApp,
      restoreSessionFromStorage,
      state,
      syncWorkerNow,
      updatePageChrome
    });

    lifecycle.bindGlobalEvents();

    documentHub.fire('visibilitychange');
    expect(persistSession).toHaveBeenCalledWith(state);
    expect(syncWorkerNow).toHaveBeenCalledTimes(1);
    expect(updatePageChrome).toHaveBeenCalledTimes(1);

    documentHub.hidden = false;
    documentHub.fire('visibilitychange');
    expect(restoreSessionFromStorage).toHaveBeenCalledWith();
    expect(reconcileSession).toHaveBeenCalledTimes(1);

    windowHub.fire('focus');
    windowHub.fire('pageshow');
    expect(reconcileSession).toHaveBeenCalledTimes(3);

    windowHub.fire('pagehide');
    expect(persistSession).toHaveBeenCalledTimes(2);

    const runningUnloadEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined
    };
    windowHub.fire('beforeunload', runningUnloadEvent);
    expect(runningUnloadEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(runningUnloadEvent.returnValue).toBe('');

    windowHub.fire('storage', {
      key: STORAGE_KEYS.activeSession
    });
    expect(restoreSessionFromStorage).toHaveBeenCalledWith({
      persist: false
    });
    expect(syncWorkerNow).toHaveBeenCalledTimes(6);
    expect(commitSession).not.toHaveBeenCalled();
    expect(renderApp).not.toHaveBeenCalled();
  });

  it('does not trigger beforeunload confirmation for idle or completed_waiting_next', () => {
    const documentHub = createEventHub();
    const windowHub = createEventHub();
    setDocument(documentHub);
    setWindow(windowHub);

    const state = {
      activeSession: createInitialSession(createDefaultSettings()),
      settings: createDefaultSettings()
    };
    const lifecycle = createLifecycleSync({
      commitSession: vi.fn(),
      persistSession: vi.fn(),
      reconcileSession: vi.fn(),
      renderApp: vi.fn(),
      restoreSessionFromStorage: vi.fn(),
      state,
      syncWorkerNow: vi.fn(),
      updatePageChrome: vi.fn()
    });
    lifecycle.bindGlobalEvents();

    const idleEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined
    };
    windowHub.fire('beforeunload', idleEvent);
    expect(idleEvent.preventDefault).not.toHaveBeenCalled();
    expect(idleEvent.returnValue).toBeUndefined();

    state.activeSession = {
      ...state.activeSession,
      status: 'completed_waiting_next'
    };
    const completedEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined
    };
    windowHub.fire('beforeunload', completedEvent);
    expect(completedEvent.preventDefault).not.toHaveBeenCalled();
    expect(completedEvent.returnValue).toBeUndefined();
  });
});
