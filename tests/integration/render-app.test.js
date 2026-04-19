import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAppRenderer } from '../../src/app/view/render-app.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession, startCurrentStep } from '../../src/core/session.js';

const originalDocument = globalThis.document;

function setDocument(value) {
  Object.defineProperty(globalThis, 'document', {
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
  let faviconLink = null;

  return {
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
    head: {
      append(element) {
        faviconLink = element;
      }
    },
    querySelector(selector) {
      if (selector === 'link[rel="icon"]') {
        return faviconLink;
      }

      return null;
    },
    title: ''
  };
}

function createLiveElementMap() {
  const attrs = {};

  return {
    '[data-live-clock]': { textContent: '' },
    '[data-live-cycle-progress]': { innerHTML: '' },
    '[data-live-progress]': {
      attrs,
      setAttribute(name, value) {
        attrs[name] = value;
      }
    },
    '[data-live-progress-fill]': { style: {} },
    '[data-live-repeat-meta]': { textContent: '' },
    '[data-live-status]': { textContent: '' },
    '[data-live-step-label]': { textContent: '' }
  };
}

describe('render app integration', () => {
  afterEach(() => {
    setDocument(originalDocument);
    vi.restoreAllMocks();
  });

  it('renders app shell and updates live timer fields and browser chrome', () => {
    const documentStub = createDocumentStub();
    setDocument(documentStub);

    const liveElements = createLiveElementMap();
    const root = {
      innerHTML: '',
      querySelector(selector) {
        return liveElements[selector] ?? null;
      }
    };
    const settings = createDefaultSettings();
    const state = {
      activeSession: startCurrentStep(createInitialSession(settings), 5_000),
      backgroundNotice: '',
      focusHistory: [],
      isNtfyTesting: false,
      manualPipRequested: false,
      notificationNotice: '',
      ntfyNotice: '',
      settings
    };
    const pipController = {
      isSupported: vi.fn(() => true)
    };
    const renderer = createAppRenderer({
      getNotificationSupportModel: () => ({
        hasNotificationApi: true,
        hasServiceWorker: true,
        permissionState: 'granted',
        unsupported: false
      }),
      pipController,
      root,
      state
    });
    const syncPictureInPicture = vi.fn();
    const maybeDispatchFocusMinuteReminder = vi.fn();
    renderer.setLiveUpdateHooks({
      maybeDispatchFocusMinuteReminder,
      syncPictureInPicture
    });

    renderer.renderApp();

    expect(root.innerHTML).toContain('class="shell"');
    expect(root.innerHTML).toContain('data-action="switch-tab"');
    expect(liveElements['[data-live-clock]'].textContent).toMatch(/\d{2}:\d{2}/);
    expect(liveElements['[data-live-status]'].textContent).toBe('Running');
    expect(liveElements['[data-live-progress]'].attrs['aria-valuenow']).toBeDefined();
    expect(liveElements['[data-live-progress-fill]'].style.width).toMatch(/%/);
    expect(documentStub.title).toContain('Focus');
    expect(syncPictureInPicture).toHaveBeenCalled();
    expect(maybeDispatchFocusMinuteReminder).toHaveBeenCalled();
  });
});
