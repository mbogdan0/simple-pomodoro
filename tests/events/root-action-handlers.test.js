import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRootActionHandlers } from '../../src/app/events/root-action-handlers.js';
import { createInitialSession } from '../../src/core/session.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { WORKER_ACTIONS } from '../../src/core/worker-protocol.js';

const originalWindow = globalThis.window;

function createState(overrides = {}) {
  const settings = createDefaultSettings();

  return {
    activeSession: createInitialSession(settings),
    backgroundNotice: '',
    focusHistory: [],
    focusNoteDraft: '',
    historyNoteEditEntryId: '',
    historyTagEditEntryId: '',
    idleStartedAt: null,
    isNtfyTesting: false,
    lastCompletionKey: '',
    lastFocusMinuteReminderKey: '',
    lastFreeTimerReminderKey: '',
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

function createActionButton(dataset = {}, detailsMenu = null) {
  return {
    dataset,
    closest(selector) {
      if (selector === 'details') {
        return detailsMenu;
      }

      return null;
    }
  };
}

function createDeps(stateOverrides = {}) {
  const state = createState(stateOverrides);
  const playCompletionTone = vi.fn(() => true);
  const playUiActionTone = vi.fn(() => true);
  const persistFocusHistory = vi.fn();
  const persistFocusNoteDraft = vi.fn();
  const persistSettings = vi.fn();
  const postWorkerAction = vi.fn();
  const renderApp = vi.fn();
  const toggleManualPipWindow = vi.fn(async () => {});

  const deps = {
    audioService: {
      playCompletionTone,
      playUiActionTone
    },
    commitSession: vi.fn(),
    notificationService: {
      requestNotificationPermission: vi.fn(async () => ''),
      testNotification: vi.fn(async () => ''),
      testNtfy: vi.fn(async () => '')
    },
    persistFocusHistory,
    persistFocusNoteDraft,
    persistSettings,
    postWorkerAction,
    renderApp,
    root: {
      addEventListener: vi.fn(),
      querySelectorAll: vi.fn(() => [])
    },
    state,
    toggleManualPipWindow
  };

  return {
    deps,
    spies: {
      persistFocusHistory,
      persistFocusNoteDraft,
      persistSettings,
      playCompletionTone,
      playUiActionTone,
      postWorkerAction,
      renderApp,
      toggleManualPipWindow
    },
    state
  };
}

async function flushPromises(cycles = 4) {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
}

describe('root action handlers', () => {
  beforeEach(() => {
    globalThis.window = {
      confirm: vi.fn(() => true)
    };
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  it('includes handlers for every supported root action', () => {
    const { deps } = createDeps();
    const { handlers } = createRootActionHandlers(deps);

    expect(Object.keys(handlers).sort()).toEqual(
      [
        'clear-history-entry',
        'discard-free-timer',
        'end-step-early',
        'finish-free-timer',
        'pause-step',
        'request-notification-permission',
        'reset-session',
        'resume-step',
        'set-focus-tag',
        'set-history-entry-focus-tag',
        'start-free-timer',
        'start-step',
        'switch-tab',
        'test-notification',
        'test-ntfy',
        'test-sound',
        'toggle-history-entry-note-edit',
        'toggle-history-entry-tag-edit',
        'toggle-pip-window'
      ].sort()
    );
  });

  it('dispatches timer command actions through the worker bridge', () => {
    const { deps, spies, state } = createDeps({
      focusNoteDraft: 'Prepare launch notes'
    });
    const { handlers } = createRootActionHandlers(deps);

    handlers['start-step'](createActionButton());
    handlers['start-free-timer'](createActionButton());
    handlers['pause-step'](createActionButton());
    handlers['resume-step'](createActionButton());
    handlers['finish-free-timer'](createActionButton());

    const resetMenu = { open: true };
    handlers['reset-session'](createActionButton({}, resetMenu));

    const endStepMenu = { open: true };
    handlers['end-step-early'](createActionButton({}, endStepMenu));
    const discardMenu = { open: true };
    handlers['discard-free-timer'](createActionButton({}, discardMenu));

    expect(resetMenu.open).toBe(false);
    expect(endStepMenu.open).toBe(false);
    expect(discardMenu.open).toBe(false);
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(1, WORKER_ACTIONS.START_STEP, {
      settings: deps.state.settings
    });
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(2, WORKER_ACTIONS.START_FREE_TIMER, {
      settings: deps.state.settings
    });
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(3, WORKER_ACTIONS.PAUSE);
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(4, WORKER_ACTIONS.RESUME);
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(5, WORKER_ACTIONS.FINISH_FREE_TIMER, {
      focusNote: 'Prepare launch notes',
      settings: deps.state.settings
    });
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(6, WORKER_ACTIONS.RESET_ALL, {
      settings: deps.state.settings
    });
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(7, WORKER_ACTIONS.END_STEP_EARLY);
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(8, WORKER_ACTIONS.DISCARD_FREE_TIMER, {
      settings: deps.state.settings
    });
    expect(globalThis.window.confirm).toHaveBeenCalledTimes(2);
    expect(state.focusNoteDraft).toBe('');
    expect(spies.persistFocusNoteDraft).toHaveBeenCalledTimes(1);
    expect(spies.renderApp).toHaveBeenCalledTimes(1);
  });

  it('handles tab and pip actions with persisted state updates', async () => {
    const { deps, spies, state } = createDeps();
    const { handlers } = createRootActionHandlers(deps);

    handlers['switch-tab'](createActionButton({ tab: 'history' }));
    handlers['toggle-pip-window'](createActionButton());
    await flushPromises();

    expect(state.settings.lastOpenTab).toBe('history');
    expect(spies.persistSettings).toHaveBeenCalledTimes(1);
    expect(spies.renderApp).toHaveBeenCalledTimes(1);
    expect(spies.toggleManualPipWindow).toHaveBeenCalledTimes(1);
    expect(spies.playUiActionTone).toHaveBeenCalledTimes(2);
  });

  it('handles history entry actions and persists the history list', () => {
    const { deps, spies, state } = createDeps({
      focusHistory: [
        {
          completedAt: 1_720_000_000_000,
          durationMs: 25 * 60 * 1000,
          focusTag: 'none',
          id: 'focus-1',
          stepId: 'step-1',
          stepType: 'work'
        },
        {
          completedAt: 1_720_000_100_000,
          durationMs: 30 * 60 * 1000,
          focusTag: 'work',
          id: 'focus-2',
          stepId: 'step-2',
          stepType: 'work'
        }
      ]
    });

    const { handlers } = createRootActionHandlers(deps);

    handlers['toggle-history-entry-tag-edit'](createActionButton({ entryId: 'focus-1' }));
    expect(state.historyTagEditEntryId).toBe('focus-1');
    expect(state.historyNoteEditEntryId).toBe('');

    handlers['toggle-history-entry-note-edit'](createActionButton({ entryId: 'focus-1' }));
    expect(state.historyNoteEditEntryId).toBe('focus-1');
    expect(state.historyTagEditEntryId).toBe('');

    handlers['toggle-history-entry-tag-edit'](createActionButton({ entryId: 'focus-2' }));
    expect(state.historyTagEditEntryId).toBe('focus-2');
    expect(state.historyNoteEditEntryId).toBe('');

    handlers['set-history-entry-focus-tag'](
      createActionButton({
        entryId: 'focus-2',
        focusTag: 'study'
      })
    );

    expect(state.focusHistory[1].focusTag).toBe('study');
    expect(state.historyTagEditEntryId).toBe('');
    expect(state.historyNoteEditEntryId).toBe('');

    handlers['clear-history-entry'](createActionButton({ entryId: 'focus-2' }));

    expect(state.focusHistory).toEqual([
      {
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusTag: 'none',
        id: 'focus-1',
        stepId: 'step-1',
        stepType: 'work'
      }
    ]);
    expect(globalThis.window.confirm).toHaveBeenCalledTimes(1);
    expect(state.historyNoteEditEntryId).toBe('');
    expect(spies.persistFocusHistory).toHaveBeenCalledTimes(2);
    expect(spies.renderApp).toHaveBeenCalledTimes(5);
  });

  it('keeps no-op behavior for missing datasets and declined confirmations', () => {
    globalThis.window.confirm = vi.fn(() => false);
    const { deps, spies, state } = createDeps({
      focusHistory: [
        {
          completedAt: 1_720_000_000_000,
          durationMs: 25 * 60 * 1000,
          focusTag: 'none',
          id: 'focus-1',
          stepId: 'step-1',
          stepType: 'work'
        }
      ]
    });
    const { handlers } = createRootActionHandlers(deps);

    handlers['set-focus-tag'](createActionButton());
    handlers['switch-tab'](createActionButton({ tab: 'invalid-tab' }));
    handlers['clear-history-entry'](createActionButton({ entryId: 'focus-1' }));
    handlers['toggle-history-entry-note-edit'](createActionButton());
    handlers['toggle-history-entry-tag-edit'](createActionButton());
    handlers['set-history-entry-focus-tag'](createActionButton({ entryId: 'focus-1' }));
    handlers['reset-session'](createActionButton({}, { open: true }));

    expect(spies.postWorkerAction).not.toHaveBeenCalled();
    expect(spies.persistSettings).not.toHaveBeenCalled();
    expect(spies.persistFocusHistory).not.toHaveBeenCalled();
    expect(spies.persistFocusNoteDraft).not.toHaveBeenCalled();
    expect(globalThis.window.confirm).toHaveBeenCalledTimes(2);
    expect(state.focusHistory).toEqual([
      {
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusTag: 'none',
        id: 'focus-1',
        stepId: 'step-1',
        stepType: 'work'
      }
    ]);
    expect(state.historyNoteEditEntryId).toBe('');
    expect(state.historyTagEditEntryId).toBe('');
  });

  it('contains async action failures and restores transient state', async () => {
    const { deps, spies, state } = createDeps();
    state.settings.ntfyPublishUrl = 'https://ntfy.sh/demo-topic';
    deps.notificationService.requestNotificationPermission = vi.fn(async () => {
      throw new Error('permission failed');
    });
    deps.notificationService.testNotification = vi.fn(async () => {
      throw new Error('notification failed');
    });
    deps.notificationService.testNtfy = vi.fn(async () => {
      throw new Error('ntfy failed');
    });
    spies.toggleManualPipWindow.mockImplementation(async () => {
      throw new Error('pip failed');
    });

    const { handlers } = createRootActionHandlers(deps);

    expect(() => handlers['request-notification-permission'](createActionButton())).not.toThrow();
    expect(() => handlers['test-notification'](createActionButton())).not.toThrow();
    expect(() => handlers['test-ntfy'](createActionButton())).not.toThrow();
    expect(() => handlers['toggle-pip-window'](createActionButton())).not.toThrow();
    expect(state.isNtfyTesting).toBe(true);

    await flushPromises();

    expect(deps.notificationService.requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(deps.notificationService.testNotification).toHaveBeenCalledTimes(1);
    expect(deps.notificationService.testNtfy).toHaveBeenCalledTimes(1);
    expect(spies.toggleManualPipWindow).toHaveBeenCalledTimes(1);
    expect(state.isNtfyTesting).toBe(false);
    expect(spies.renderApp).toHaveBeenCalledTimes(4);
  });
});
