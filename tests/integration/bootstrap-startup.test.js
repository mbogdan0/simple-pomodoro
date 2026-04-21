import { afterEach, describe, expect, it, vi } from 'vitest';

import { startApp } from '../../src/app/bootstrap.js';
import { createMemoryStorage } from '../../src/core/storage.js';

const originalDocument = globalThis.document;
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
    title: ''
  };
}

function createWindowStub() {
  const handlers = {};

  return {
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    confirm() {
      return true;
    },
    handlers,
    isSecureContext: false
  };
}

describe('bootstrap startup integration', () => {
  afterEach(() => {
    setDocument(originalDocument);
    setLocalStorage(originalLocalStorage);
    setNavigator(originalNavigator);
    setWindow(originalWindow);
    setWorker(originalWorker);
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
});
