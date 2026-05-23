import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRootEvents } from '../../src/app/events/root-events.js';
import { createInitialSession } from '../../src/core/session.js';
import { createDefaultSettings } from '../../src/core/settings.js';

const originalDocument = globalThis.document;
const originalHTMLInputElement = globalThis.HTMLInputElement;
const originalWindow = globalThis.window;

function createState(overrides = {}) {
  const settings = createDefaultSettings();

  return {
    activeSession: createInitialSession(settings),
    backgroundNotice: '',
    focusHistory: [],
    focusNoteDraft: '',
    historyTagEditEntryId: '',
    idleStartedAt: null,
    isNtfyTesting: false,
    lastCompletionKey: '',
    lastFocusMinuteReminderKey: '',
    lastIdleReminderAt: Date.now(),
    manualPipRequested: false,
    notificationNotice: '',
    ntfyNotice: '',
    pauseStartedAt: null,
    serviceWorkerReady: false,
    settings,
    ...overrides
  };
}

function createDeps(rootOverrides = {}, stateOverrides = {}) {
  const state = createState(stateOverrides);

  const root = {
    addEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    ...rootOverrides
  };

  return {
    deps: {
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone: vi.fn(() => true)
      },
      commitSession: vi.fn(),
      notificationService: {
        requestNotificationPermission: vi.fn(async () => ''),
        testNotification: vi.fn(async () => ''),
        testNtfy: vi.fn(async () => '')
      },
      persistFocusHistory: vi.fn(),
      persistFocusNoteDraft: vi.fn(),
      persistSettings: vi.fn(),
      postWorkerAction: vi.fn(),
      renderApp: vi.fn(),
      root,
      state,
      toggleManualPipWindow: vi.fn(async () => {})
    },
    root,
    state
  };
}

describe('root events shell', () => {
  beforeEach(() => {
    globalThis.window = {
      confirm: vi.fn(() => true)
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.HTMLInputElement = originalHTMLInputElement;
    globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  it('keeps unknown actions and missing action datasets as no-ops', () => {
    const openMenu = { open: true };
    const { deps } = createDeps({
      querySelectorAll: vi.fn(() => [openMenu])
    });
    const rootEvents = createRootEvents(deps);

    rootEvents.handleRootClick({
      target: {
        closest(selector) {
          if (selector === '.overflow-actions') {
            return null;
          }

          if (selector === '[data-action]') {
            return {
              dataset: {
                action: 'unknown-action'
              }
            };
          }

          return null;
        }
      }
    });

    expect(openMenu.open).toBe(false);
    expect(deps.postWorkerAction).not.toHaveBeenCalled();
    expect(deps.persistSettings).not.toHaveBeenCalled();

    rootEvents.handleRootClick({
      target: {
        closest(selector) {
          if (selector === '[data-action]') {
            return {
              dataset: {}
            };
          }

          return null;
        }
      }
    });

    expect(deps.postWorkerAction).not.toHaveBeenCalled();
    expect(deps.renderApp).not.toHaveBeenCalled();
  });

  it('binds root and document listeners and closes open menu on document click', () => {
    const openMenu = { open: true };
    const documentHandlers = {};
    const { deps, root } = createDeps({
      querySelectorAll: vi.fn(() => [openMenu])
    });

    globalThis.document = {
      addEventListener(type, handler) {
        documentHandlers[type] = handler;
      }
    };

    const rootEvents = createRootEvents(deps);
    rootEvents.bindRootEvents();

    expect(root.addEventListener).toHaveBeenCalledTimes(3);
    expect(documentHandlers.click).toBeTypeOf('function');

    documentHandlers.click({
      target: {
        closest() {
          return null;
        }
      }
    });

    expect(openMenu.open).toBe(false);
  });

  it('normalizes and persists focus note draft on input without re-rendering', () => {
    class FakeHTMLInputElement {
      constructor() {
        this.value = '';
      }

      matches(selector) {
        return selector === '[data-focus-note-input]';
      }
    }

    globalThis.HTMLInputElement = FakeHTMLInputElement;

    const { deps, state } = createDeps();
    const rootEvents = createRootEvents(deps);
    const input = new FakeHTMLInputElement();
    input.value = 'Keep shipping reliable release notes for sprint 8';

    rootEvents.handleRootInput({ target: input });

    expect(state.focusNoteDraft).toBe('Keep shipping reliable release');
    expect(input.value).toBe('Keep shipping reliable release');
    expect(deps.persistFocusNoteDraft).toHaveBeenCalledTimes(1);
    expect(deps.renderApp).not.toHaveBeenCalled();
  });
});
