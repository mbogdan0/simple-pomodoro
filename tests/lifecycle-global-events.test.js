import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLifecycleGlobalEvents } from '../src/app/runtime/lifecycle-global-events.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession, startCurrentStep } from '../src/core/session.js';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

function setDocument(value) {
  Object.defineProperty(globalThis, 'document', {
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
  const addEventListener = vi.fn((type, handler) => {
    handlers[type] = handler;
  });
  const removeEventListener = vi.fn((type, handler) => {
    if (handlers[type] === handler) {
      delete handlers[type];
    }
  });

  return {
    addEventListener,
    fire(type, payload) {
      handlers[type]?.(payload);
    },
    handlers,
    removeEventListener
  };
}

describe('lifecycle global events', () => {
  afterEach(() => {
    setDocument(originalDocument);
    setWindow(originalWindow);
    vi.restoreAllMocks();
  });

  it('binds lifecycle listeners and routes browser events', () => {
    const documentHub = createEventHub();
    documentHub.hidden = true;
    const windowHub = createEventHub();
    setDocument(documentHub);
    setWindow(windowHub);

    const state = {
      activeSession: startCurrentStep(createInitialSession(createDefaultSettings()), 1_000),
      settings: createDefaultSettings()
    };
    const handleStorageSyncEvent = vi.fn();
    const persistSession = vi.fn();
    const reconcileSession = vi.fn();
    const restoreSessionFromStorage = vi.fn();
    const syncWorkerNow = vi.fn();
    const updatePageChrome = vi.fn();
    const lifecycleGlobalEvents = createLifecycleGlobalEvents({
      handleStorageSyncEvent,
      persistSession,
      reconcileSession,
      restoreSessionFromStorage,
      state,
      syncWorkerNow,
      updatePageChrome
    });

    lifecycleGlobalEvents.bindGlobalEvents();
    lifecycleGlobalEvents.bindGlobalEvents();

    expect(documentHub.addEventListener).toHaveBeenCalledTimes(1);
    expect(windowHub.addEventListener).toHaveBeenCalledTimes(5);

    documentHub.fire('visibilitychange');
    expect(persistSession).toHaveBeenCalledWith(state);
    expect(syncWorkerNow).toHaveBeenCalledTimes(1);
    expect(updatePageChrome).toHaveBeenCalledTimes(1);

    documentHub.hidden = false;
    documentHub.fire('visibilitychange');
    expect(restoreSessionFromStorage).toHaveBeenCalledWith();
    expect(reconcileSession).toHaveBeenCalledTimes(1);
    expect(syncWorkerNow).toHaveBeenCalledTimes(2);

    windowHub.fire('focus');
    windowHub.fire('pageshow');
    expect(reconcileSession).toHaveBeenCalledTimes(3);

    windowHub.fire('pagehide');
    expect(persistSession).toHaveBeenCalledTimes(2);

    const unloadEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined
    };
    windowHub.fire('beforeunload', unloadEvent);
    expect(unloadEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(unloadEvent.returnValue).toBe('');

    windowHub.fire('storage', {
      key: 'activeSession'
    });
    expect(handleStorageSyncEvent).toHaveBeenCalledWith({
      key: 'activeSession'
    });

    lifecycleGlobalEvents.dispose();
    lifecycleGlobalEvents.dispose();
    expect(documentHub.removeEventListener).toHaveBeenCalledTimes(1);
    expect(windowHub.removeEventListener).toHaveBeenCalledTimes(5);
  });

  it('skips beforeunload confirmation for idle or completed_waiting_next', () => {
    const documentHub = createEventHub();
    const windowHub = createEventHub();
    setDocument(documentHub);
    setWindow(windowHub);

    const state = {
      activeSession: createInitialSession(createDefaultSettings()),
      settings: createDefaultSettings()
    };
    const lifecycleGlobalEvents = createLifecycleGlobalEvents({
      handleStorageSyncEvent: vi.fn(),
      persistSession: vi.fn(),
      reconcileSession: vi.fn(),
      restoreSessionFromStorage: vi.fn(),
      state,
      syncWorkerNow: vi.fn(),
      updatePageChrome: vi.fn()
    });

    lifecycleGlobalEvents.bindGlobalEvents();
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
