import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRootEvents } from '../../src/app/events/root-events.js';
import { createWorkerBridge } from '../../src/app/runtime/worker-bridge.js';
import { createSessionController } from '../../src/app/session/session-controller.js';
import { createMemoryStorage, saveActiveSession } from '../../src/core/storage.js';
import { createDefaultSettings, sanitizeRepeatCount } from '../../src/core/settings.js';
import {
  createInitialSession,
  normalizeSession,
  startCurrentStep
} from '../../src/core/session.js';
import { WORKER_ACTIONS } from '../../src/core/worker-protocol.js';

const originalLocalStorage = globalThis.localStorage;
const originalHTMLElement = globalThis.HTMLElement;
const originalHTMLInputElement = globalThis.HTMLInputElement;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

function createSessionHarness(stateOverrides = {}) {
  const settings = createDefaultSettings();
  const state = {
    activeSession: createInitialSession(settings),
    backgroundNotice: '',
    focusHistory: [],
    historyTagEditEntryId: '',
    isNtfyTesting: false,
    lastCompletionKey: '',
    lastFocusMinuteReminderKey: '',
    manualPipRequested: false,
    notificationNotice: '',
    ntfyNotice: '',
    serviceWorkerReady: false,
    settings,
    ...stateOverrides
  };
  const dispatchCompletionAlerts = vi.fn();
  const persistFocusHistory = vi.fn();
  const persistSession = vi.fn();
  const renderApp = vi.fn();
  const updateTimerLiveRegion = vi.fn();
  const updatePageChrome = vi.fn();
  const syncWorkerState = vi.fn();
  const sessionController = createSessionController({
    dispatchCompletionAlerts,
    persistFocusHistory,
    persistSession,
    renderApp,
    state,
    syncWorkerState,
    updatePageChrome,
    updateTimerLiveRegion
  });

  return {
    sessionController,
    state,
    syncWorkerState
  };
}

describe('app runtime integration', () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
    globalThis.window = {
      confirm: () => true
    };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
    globalThis.HTMLElement = originalHTMLElement;
    globalThis.HTMLInputElement = originalHTMLInputElement;
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    vi.restoreAllMocks();
  });

  it('runs start/pause/resume/end-early/reset flow through worker bridge local fallback', () => {
    const { sessionController, state } = createSessionHarness();
    const workerBridge = createWorkerBridge({
      handleLocalAction: sessionController.handleLocalAction,
      onWorkerState: vi.fn(),
      onWorkerTick: vi.fn(),
      onWorkerUnavailable: vi.fn(),
      state
    });

    workerBridge.postWorkerAction(WORKER_ACTIONS.START_STEP, { settings: state.settings });
    expect(state.activeSession.status).toBe('running');

    workerBridge.postWorkerAction(WORKER_ACTIONS.PAUSE);
    expect(state.activeSession.status).toBe('paused');

    workerBridge.postWorkerAction(WORKER_ACTIONS.RESUME);
    expect(state.activeSession.status).toBe('running');

    workerBridge.postWorkerAction(WORKER_ACTIONS.END_STEP_EARLY, { now: 2_000 });
    expect(state.activeSession.status).toBe('idle');
    expect(state.activeSession.currentStepIndex).toBe(1);

    workerBridge.postWorkerAction(WORKER_ACTIONS.RESET_ALL, { settings: state.settings });
    expect(state.activeSession.status).toBe('idle');
    expect(state.activeSession.currentStepIndex).toBe(0);
  });

  it('restores fresher session snapshot from storage and resyncs worker state', () => {
    const settings = createDefaultSettings();
    const base = createInitialSession(settings);
    const running = startCurrentStep(base, 1_000);
    const fresher = normalizeSession(
      {
        ...running,
        updatedAt: (running.updatedAt ?? 0) + 10_000
      },
      settings
    );
    saveActiveSession(fresher, globalThis.localStorage);

    const { sessionController, state, syncWorkerState } = createSessionHarness({
      activeSession: {
        ...base,
        updatedAt: 1
      },
      settings
    });

    sessionController.restoreSessionFromStorage();

    expect(state.activeSession.updatedAt).toBe(fresher.updatedAt);
    expect(syncWorkerState).toHaveBeenCalledTimes(1);
  });

  it('applies root events for tab switch and repeat-count settings mutation', () => {
    class FakeHTMLElement {
      constructor() {
        this.dataset = {};
        this.value = '';
      }
    }
    class FakeHTMLInputElement extends FakeHTMLElement {}
    globalThis.HTMLElement = FakeHTMLElement;
    globalThis.HTMLInputElement = FakeHTMLInputElement;

    const { state } = createSessionHarness();
    const commitSession = vi.fn();
    const persistSettings = vi.fn();
    const playUiActionTone = vi.fn();
    const rootEvents = createRootEvents({
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone
      },
      commitSession,
      notificationService: {
        requestNotificationPermission: vi.fn(async () => ''),
        testNotification: vi.fn(async () => ''),
        testNtfy: vi.fn(async () => '')
      },
      persistFocusHistory: vi.fn(),
      persistSettings,
      postWorkerAction: vi.fn(),
      renderApp: vi.fn(),
      root: {
        addEventListener: vi.fn()
      },
      state,
      toggleManualPipWindow: vi.fn(async () => {})
    });

    rootEvents.handleRootClick({
      target: {
        closest(selector) {
          if (selector === '[data-action]') {
            return {
              dataset: {
                action: 'switch-tab',
                tab: 'history'
              }
            };
          }

          return null;
        }
      }
    });
    expect(state.settings.lastOpenTab).toBe('history');
    expect(playUiActionTone).toHaveBeenCalledTimes(1);

    const repeatInput = new FakeHTMLElement();
    repeatInput.matches = (selector) => selector === '[data-repeat-count]';
    repeatInput.value = '6';
    rootEvents.handleRootChange({
      target: repeatInput
    });

    expect(state.settings.repeatCount).toBe(sanitizeRepeatCount('6', 4));
    expect(persistSettings).toHaveBeenCalled();
    expect(commitSession).toHaveBeenCalled();
  });

  it('toggles idle reminders and syncs the worker setting', () => {
    class FakeHTMLElement {
      constructor() {
        this.checked = false;
        this.dataset = {};
      }
    }
    class FakeHTMLInputElement extends FakeHTMLElement {}
    globalThis.HTMLElement = FakeHTMLElement;
    globalThis.HTMLInputElement = FakeHTMLInputElement;

    const { state } = createSessionHarness();
    const persistSettings = vi.fn();
    const postWorkerAction = vi.fn();
    const renderApp = vi.fn();
    const rootEvents = createRootEvents({
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone: vi.fn()
      },
      commitSession: vi.fn(),
      notificationService: {
        requestNotificationPermission: vi.fn(async () => ''),
        testNotification: vi.fn(async () => ''),
        testNtfy: vi.fn(async () => '')
      },
      persistFocusHistory: vi.fn(),
      persistSettings,
      postWorkerAction,
      renderApp,
      root: {
        addEventListener: vi.fn()
      },
      state,
      toggleManualPipWindow: vi.fn(async () => {})
    });

    const idleReminderInput = new FakeHTMLInputElement();
    idleReminderInput.checked = true;
    idleReminderInput.dataset.settingToggle = 'idleReminderEnabled';
    idleReminderInput.matches = (selector) => selector === '[data-setting-toggle]';

    rootEvents.handleRootChange({
      target: idleReminderInput
    });

    expect(state.settings.idleReminderEnabled).toBe(true);
    expect(persistSettings).toHaveBeenCalledTimes(1);
    expect(postWorkerAction).toHaveBeenCalledWith(WORKER_ACTIONS.SET_IDLE_REMINDER, {
      enabled: true
    });
    expect(renderApp).toHaveBeenCalledTimes(1);
  });

  it('confirms end-step-early action and dispatches worker command', () => {
    const postWorkerAction = vi.fn();
    const confirmSpy = vi.fn(() => true);
    globalThis.window.confirm = confirmSpy;

    const rootEvents = createRootEvents({
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone: vi.fn()
      },
      commitSession: vi.fn(),
      notificationService: {
        requestNotificationPermission: vi.fn(async () => ''),
        testNotification: vi.fn(async () => ''),
        testNtfy: vi.fn(async () => '')
      },
      persistFocusHistory: vi.fn(),
      persistSettings: vi.fn(),
      postWorkerAction,
      renderApp: vi.fn(),
      root: {
        addEventListener: vi.fn()
      },
      state: createSessionHarness().state,
      toggleManualPipWindow: vi.fn(async () => {})
    });

    const menu = { open: true };
    const actionButton = {
      dataset: {
        action: 'end-step-early'
      },
      closest(selector) {
        return selector === 'details' ? menu : null;
      }
    };

    rootEvents.handleRootClick({
      target: {
        closest() {
          return actionButton;
        }
      }
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(postWorkerAction).toHaveBeenCalledWith(WORKER_ACTIONS.END_STEP_EARLY);
    expect(menu.open).toBe(false);
  });

  it('closes open overflow menu on click outside actions area', () => {
    const openMenu = { open: true };
    const rootEvents = createRootEvents({
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone: vi.fn()
      },
      commitSession: vi.fn(),
      notificationService: {
        requestNotificationPermission: vi.fn(async () => ''),
        testNotification: vi.fn(async () => ''),
        testNtfy: vi.fn(async () => '')
      },
      persistFocusHistory: vi.fn(),
      persistSettings: vi.fn(),
      postWorkerAction: vi.fn(),
      renderApp: vi.fn(),
      root: {
        addEventListener: vi.fn(),
        querySelectorAll() {
          return [openMenu];
        }
      },
      state: createSessionHarness().state,
      toggleManualPipWindow: vi.fn(async () => {})
    });

    rootEvents.handleRootClick({
      target: {
        closest() {
          return null;
        }
      }
    });

    expect(openMenu.open).toBe(false);
  });

  it('closes open overflow menu on document body click', () => {
    const openMenu = { open: true };
    const documentHandlers = {};
    globalThis.document = {
      addEventListener(type, handler) {
        documentHandlers[type] = handler;
      }
    };

    const rootEvents = createRootEvents({
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone: vi.fn()
      },
      commitSession: vi.fn(),
      notificationService: {
        requestNotificationPermission: vi.fn(async () => ''),
        testNotification: vi.fn(async () => ''),
        testNtfy: vi.fn(async () => '')
      },
      persistFocusHistory: vi.fn(),
      persistSettings: vi.fn(),
      postWorkerAction: vi.fn(),
      renderApp: vi.fn(),
      root: {
        addEventListener: vi.fn(),
        querySelectorAll() {
          return [openMenu];
        }
      },
      state: createSessionHarness().state,
      toggleManualPipWindow: vi.fn(async () => {})
    });

    rootEvents.bindRootEvents();
    documentHandlers.click({
      target: {
        closest() {
          return null;
        }
      }
    });

    expect(openMenu.open).toBe(false);
  });

  it('plays UI action tone when overflow button is clicked', () => {
    const playUiActionTone = vi.fn();
    const rootEvents = createRootEvents({
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone
      },
      commitSession: vi.fn(),
      notificationService: {
        requestNotificationPermission: vi.fn(async () => ''),
        testNotification: vi.fn(async () => ''),
        testNtfy: vi.fn(async () => '')
      },
      persistFocusHistory: vi.fn(),
      persistSettings: vi.fn(),
      postWorkerAction: vi.fn(),
      renderApp: vi.fn(),
      root: {
        addEventListener: vi.fn(),
        querySelectorAll() {
          return [];
        }
      },
      state: createSessionHarness().state,
      toggleManualPipWindow: vi.fn(async () => {})
    });

    rootEvents.handleRootClick({
      target: {
        closest(selector) {
          if (selector === '.overflow-actions') {
            return {};
          }

          if (selector === '.action-button--overflow') {
            return {};
          }

          if (selector === '[data-action]') {
            return null;
          }

          return null;
        }
      }
    });

    expect(playUiActionTone).toHaveBeenCalledTimes(1);
  });

  it('toggles and applies inline history tag edit actions', () => {
    const persistFocusHistory = vi.fn();
    const renderApp = vi.fn();
    const { state } = createSessionHarness({
      focusHistory: [
        {
          completedAt: 1_720_000_000_000,
          durationMs: 25 * 60 * 1000,
          focusTag: 'none',
          id: 'focus-1',
          stepId: 'focus-1',
          stepType: 'work'
        }
      ]
    });

    const rootEvents = createRootEvents({
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone: vi.fn()
      },
      commitSession: vi.fn(),
      notificationService: {
        requestNotificationPermission: vi.fn(async () => ''),
        testNotification: vi.fn(async () => ''),
        testNtfy: vi.fn(async () => '')
      },
      persistFocusHistory,
      persistSettings: vi.fn(),
      postWorkerAction: vi.fn(),
      renderApp,
      root: {
        addEventListener: vi.fn(),
        querySelectorAll() {
          return [];
        }
      },
      state,
      toggleManualPipWindow: vi.fn(async () => {})
    });

    rootEvents.handleRootClick({
      target: {
        closest(selector) {
          if (selector === '[data-action]') {
            return {
              dataset: {
                action: 'toggle-history-entry-tag-edit',
                entryId: 'focus-1'
              }
            };
          }

          return null;
        }
      }
    });

    expect(state.historyTagEditEntryId).toBe('focus-1');
    expect(persistFocusHistory).not.toHaveBeenCalled();

    rootEvents.handleRootClick({
      target: {
        closest(selector) {
          if (selector === '[data-action]') {
            return {
              dataset: {
                action: 'set-history-entry-focus-tag',
                entryId: 'focus-1',
                focusTag: 'study'
              }
            };
          }

          return null;
        }
      }
    });

    expect(state.focusHistory[0].focusTag).toBe('study');
    expect(state.historyTagEditEntryId).toBe('');
    expect(persistFocusHistory).toHaveBeenCalledTimes(1);
    expect(renderApp).toHaveBeenCalledTimes(2);
  });
});
