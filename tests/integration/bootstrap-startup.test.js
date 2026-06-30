import { afterEach, describe, expect, it, vi } from 'vitest';

import { startApp } from '../../src/app/bootstrap.js';
import { STORAGE_KEYS } from '../../src/core/constants.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession } from '../../src/core/session.js';
import {
  createMemoryStorage,
  saveActiveSession,
  saveFocusNoteDraft
} from '../../src/core/storage.js';

const originalDocument = globalThis.document;
const originalClearInterval = globalThis.clearInterval;
const originalLocalStorage = globalThis.localStorage;
const originalNavigator = globalThis.navigator;
const originalSetInterval = globalThis.setInterval;
const originalWindow = globalThis.window;
const originalWorker = globalThis.Worker;

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

function setWorker(value) {
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value
  });
}

function createCanvasStub() {
  return {
    getContext() {
      return {
        arc() {},
        beginPath() {},
        clearRect() {},
        fill() {},
        fillText() {},
        stroke() {}
      };
    },
    height: 0,
    toDataURL() {
      return 'data:image/png;base64,fake';
    },
    width: 0
  };
}

function createDocumentStub() {
  const handlers = {};
  let faviconLink = null;
  const removeEventListener = vi.fn((type, handler) => {
    if (handlers[type] === handler) {
      delete handlers[type];
    }
  });

  return {
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    createElement(tagName) {
      if (tagName === 'link') {
        return {
          href: '',
          rel: ''
        };
      }

      if (tagName === 'canvas') {
        return createCanvasStub();
      }

      return {};
    },
    handlers,
    head: {
      append(element) {
        faviconLink = element;
      }
    },
    hidden: false,
    querySelector(selector) {
      if (selector === 'link[rel="icon"]') {
        return faviconLink;
      }

      return null;
    },
    removeEventListener,
    title: ''
  };
}

function createWindowStub() {
  const handlers = {};
  const removeEventListener = vi.fn((type, handler) => {
    if (handlers[type] === handler) {
      delete handlers[type];
    }
  });

  return {
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    confirm() {
      return true;
    },
    handlers,
    isSecureContext: false,
    removeEventListener
  };
}

describe('bootstrap startup integration', () => {
  afterEach(() => {
    setDocument(originalDocument);
    setLocalStorage(originalLocalStorage);
    setNavigator(originalNavigator);
    setWindow(originalWindow);
    setWorker(originalWorker);
    globalThis.clearInterval = originalClearInterval;
    globalThis.setInterval = originalSetInterval;
    vi.restoreAllMocks();
  });

  it('starts app and wires runtime listeners when Worker is unavailable', () => {
    const documentStub = createDocumentStub();
    const windowStub = createWindowStub();
    const rootListeners = {};
    const root = {
      addEventListener(type, handler) {
        rootListeners[type] = handler;
      },
      innerHTML: '',
      querySelector() {
        return null;
      }
    };

    setDocument(documentStub);
    setLocalStorage(createMemoryStorage());
    setNavigator({});
    setWindow(windowStub);
    setWorker(undefined);
    globalThis.setInterval = vi.fn(() => 1);

    const app = startApp(root);

    expect(app.state).toBeTruthy();
    expect(app.state.backgroundNotice).toBe(
      'This browser may throttle timer updates in background tabs.'
    );
    expect(root.innerHTML).toContain('class="shell"');
    expect(root.innerHTML).toContain('data-action="switch-tab"');
    expect(rootListeners.click).toBeTypeOf('function');
    expect(rootListeners.change).toBeTypeOf('function');
    expect(rootListeners.input).toBeTypeOf('function');
    expect(documentStub.handlers.visibilitychange).toBeTypeOf('function');
    expect(windowStub.handlers.focus).toBeTypeOf('function');
    expect(windowStub.handlers.beforeunload).toBeTypeOf('function');
    expect(windowStub.handlers.pageshow).toBeTypeOf('function');
    expect(windowStub.handlers.pagehide).toBeTypeOf('function');
    expect(windowStub.handlers.storage).toBeTypeOf('function');
    expect(windowStub.handlers.pointerdown).toBeTypeOf('function');
    expect(windowStub.handlers.keydown).toBeTypeOf('function');
    expect(globalThis.setInterval).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  it('opens stale startup modal and resets when user accepts', () => {
    const documentStub = createDocumentStub();
    const rootListeners = {};
    const root = {
      addEventListener(type, handler) {
        rootListeners[type] = handler;
      },
      innerHTML: '',
      querySelector() {
        return null;
      }
    };
    const settings = createDefaultSettings();
    const staleSession = {
      ...createInitialSession(settings),
      currentStepIndex: 2,
      updatedAt: Date.now() - 61 * 60 * 1000
    };
    const storage = createMemoryStorage();

    saveActiveSession(staleSession, storage);
    saveFocusNoteDraft('Ship staged rollout checklist', storage);

    setDocument(documentStub);
    setLocalStorage(storage);
    setNavigator({});
    setWindow({
      addEventListener: vi.fn(),
      handlers: {},
      isSecureContext: false
    });
    setWorker(undefined);
    globalThis.setInterval = vi.fn(() => 1);

    const app = startApp(root);

    expect(app.state.modal).toEqual({ type: 'stale-session' });
    expect(root.innerHTML).toContain('Start a new session?');

    rootListeners.click({
      target: {
        closest(selector) {
          if (selector !== '[data-action]') {
            return null;
          }

          return {
            dataset: {
              action: 'confirm-stale-session-reset'
            }
          };
        }
      }
    });

    expect(app.state.modal).toBeNull();
    expect(app.state.activeSession.currentStepIndex).toBe(0);
    expect(app.state.focusNoteDraft).toBe('');
    expect(storage.getItem(STORAGE_KEYS.focusNoteDraft)).toBe('""');
  });

  it('keeps stale startup session when user cancels reset modal', () => {
    const documentStub = createDocumentStub();
    const rootListeners = {};
    const root = {
      addEventListener(type, handler) {
        rootListeners[type] = handler;
      },
      innerHTML: '',
      querySelector() {
        return null;
      }
    };
    const settings = createDefaultSettings();
    const staleSession = {
      ...createInitialSession(settings),
      currentStepIndex: 3,
      updatedAt: Date.now() - 61 * 60 * 1000
    };
    const storage = createMemoryStorage();

    saveActiveSession(staleSession, storage);
    saveFocusNoteDraft('Keep this note', storage);

    setDocument(documentStub);
    setLocalStorage(storage);
    setNavigator({});
    setWindow({
      addEventListener: vi.fn(),
      handlers: {},
      isSecureContext: false
    });
    setWorker(undefined);
    globalThis.setInterval = vi.fn(() => 1);

    const app = startApp(root);

    expect(app.state.modal).toEqual({ type: 'stale-session' });
    rootListeners.click({
      target: {
        closest(selector) {
          if (selector !== '[data-action]') {
            return null;
          }

          return {
            dataset: {
              action: 'cancel-modal'
            }
          };
        }
      }
    });

    expect(app.state.modal).toBeNull();
    expect(app.state.activeSession.currentStepIndex).toBe(3);
    expect(app.state.focusNoteDraft).toBe('Keep this note');
  });

  it('disposes runtime listeners, interval, and worker resources safely', () => {
    const documentStub = createDocumentStub();
    const windowStub = createWindowStub();
    const rootListeners = {};
    const root = {
      addEventListener(type, handler) {
        rootListeners[type] = handler;
      },
      innerHTML: '',
      querySelector() {
        return null;
      },
      removeEventListener: vi.fn((type, handler) => {
        if (rootListeners[type] === handler) {
          delete rootListeners[type];
        }
      })
    };
    const workerInstances = [];
    class FakeWorker {
      constructor() {
        this.handlers = {};
        this.postMessage = vi.fn();
        this.terminate = vi.fn();
        workerInstances.push(this);
      }

      addEventListener(type, handler) {
        this.handlers[type] = handler;
      }

      removeEventListener(type, handler) {
        if (this.handlers[type] === handler) {
          delete this.handlers[type];
        }
      }
    }

    setDocument(documentStub);
    setLocalStorage(createMemoryStorage());
    setNavigator({});
    setWindow(windowStub);
    setWorker(FakeWorker);
    globalThis.setInterval = vi.fn(() => 42);
    globalThis.clearInterval = vi.fn();

    const app = startApp(root);

    expect(workerInstances).toHaveLength(1);
    expect(rootListeners.click).toBeTypeOf('function');
    expect(windowStub.handlers.storage).toBeTypeOf('function');
    expect(documentStub.handlers.visibilitychange).toBeTypeOf('function');

    app.dispose();
    app.dispose();

    expect(globalThis.clearInterval).toHaveBeenCalledTimes(1);
    expect(globalThis.clearInterval).toHaveBeenCalledWith(42);
    expect(root.removeEventListener).toHaveBeenCalledTimes(3);
    expect(windowStub.removeEventListener).toHaveBeenCalledTimes(7);
    expect(documentStub.removeEventListener).toHaveBeenCalledTimes(3);
    expect(workerInstances[0].terminate).toHaveBeenCalledTimes(1);
  });
});
