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

function createSessionHarness(stateOverrides = {}) {
  const settings = createDefaultSettings();
  const state = {
    activeSession: createInitialSession(settings),
    backgroundNotice: '',
    focusHistory: [],
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
    vi.restoreAllMocks();
  });

  it('runs start/pause/resume/reset flow through worker bridge local fallback', () => {
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
    const rootEvents = createRootEvents({
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone: vi.fn()
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
        closest() {
          return {
            dataset: {
              action: 'switch-tab',
              tab: 'history'
            }
          };
        }
      }
    });
    expect(state.settings.lastOpenTab).toBe('history');

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
});
