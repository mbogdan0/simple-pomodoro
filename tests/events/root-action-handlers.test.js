import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRootActionHandlers } from '../../src/app/events/root-action-handlers.js';
import { createInitialSession, startCurrentStep } from '../../src/core/session.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { WORKER_ACTIONS } from '../../src/core/worker-protocol.js';

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalURL = globalThis.URL;

function createState(overrides = {}) {
  const settings = createDefaultSettings();

  return {
    activeSession: createInitialSession(settings),
    backgroundNotice: '',
    focusHistory: [],
    focusNoteDraft: '',
    historyNoteEditEntryId: '',
    historyTagEditEntryId: '',
    historyImportNotice: '',
    idleStartedAt: null,
    isNtfyTesting: false,
    lastCompletionKey: '',
    lastFocusHistoryExportedAt: null,
    lastFocusMinuteReminderKey: '',
    lastIdleReminderAt: Date.now(),
    lastOvertimeReminderKey: '',
    manualPipRequested: false,
    modal: null,
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
  const persistFocusHistoryLastExportedAt = vi.fn();
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
    persistFocusHistoryLastExportedAt,
    persistFocusNoteDraft,
    persistSettings,
    postWorkerAction,
    renderApp,
    root: {
      addEventListener: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => [])
    },
    state,
    toggleManualPipWindow
  };

  return {
    deps,
    spies: {
      persistFocusHistory,
      persistFocusHistoryLastExportedAt,
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
    globalThis.document = originalDocument;
    globalThis.URL = originalURL;
    globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  it('includes handlers for every supported root action', () => {
    const { deps } = createDeps();
    const { handlers } = createRootActionHandlers(deps);

    expect(Object.keys(handlers).sort()).toEqual(
      [
        'advance-break',
        'cancel-modal',
        'clear-history-entry',
        'confirm-clear-history-entry',
        'confirm-reset-run',
        'confirm-stale-session-reset',
        'export-focus-history',
        'import-focus-history',
        'pause-step',
        'request-notification-permission',
        'reset-run',
        'resume-step',
        'save-focus-actual',
        'save-focus-planned',
        'set-focus-tag',
        'set-history-entry-focus-tag',
        'skip-focus-history',
        'start-break',
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
    const settings = createDefaultSettings();
    const { deps, spies, state } = createDeps({
      activeSession: startCurrentStep(createInitialSession(settings), 1_000),
      focusNoteDraft: 'Prepare launch notes'
    });
    state.settings = settings;
    const { handlers } = createRootActionHandlers(deps);

    handlers['start-step'](createActionButton());
    handlers['pause-step'](createActionButton());
    handlers['resume-step'](createActionButton());

    const resetMenu = { open: true };
    handlers['reset-run'](createActionButton({}, resetMenu));

    handlers['start-break'](createActionButton());
    expect(state.modal).toEqual({ type: 'focus-save' });
    handlers['save-focus-actual'](createActionButton());

    expect(resetMenu.open).toBe(false);
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(1, WORKER_ACTIONS.START_STEP, {
      settings: deps.state.settings
    });
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(2, WORKER_ACTIONS.PAUSE);
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(3, WORKER_ACTIONS.RESUME);
    expect(spies.postWorkerAction).toHaveBeenNthCalledWith(4, WORKER_ACTIONS.ADVANCE_FOCUS, {
      focusNote: 'Prepare launch notes',
      historySaveMode: 'actual',
      settings: deps.state.settings
    });
    expect(state.focusNoteDraft).toBe('');
    expect(spies.persistFocusNoteDraft).toHaveBeenCalledTimes(1);
    expect(spies.renderApp).toHaveBeenCalledTimes(3);
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
    expect(state.modal).toEqual({
      entryId: 'focus-2',
      type: 'clear-history-entry'
    });
    handlers['confirm-clear-history-entry'](createActionButton());

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
    expect(spies.persistFocusHistory).toHaveBeenCalledTimes(2);
    expect(spies.renderApp).toHaveBeenCalledTimes(6);
  });

  it('exports focus history and records the export timestamp', () => {
    const append = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:focus-history');
    globalThis.document = {
      body: {
        append
      },
      createElement(tagName) {
        expect(tagName).toBe('a');
        return {
          click,
          remove,
          style: {}
        };
      }
    };
    globalThis.URL = {
      createObjectURL,
      revokeObjectURL
    };
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_780_000_000_000);
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

    handlers['export-focus-history'](createActionButton());

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:focus-history');
    expect(state.lastFocusHistoryExportedAt).toBe(1_780_000_000_000);
    expect(spies.persistFocusHistoryLastExportedAt).toHaveBeenCalledTimes(1);
    expect(spies.renderApp).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore();
  });

  it('imports focus history from a temporary file input', async () => {
    let changeHandler = null;
    const append = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const input = {
      accept: '',
      addEventListener(type, handler) {
        if (type === 'change') {
          changeHandler = handler;
        }
      },
      click,
      files: [
        {
          text: vi.fn(async () =>
            JSON.stringify({
              app: 'Simple Pomodoro Timer',
              exportedAt: 1_782_888_573_513,
              focusHistory: [
                {
                  completedAt: 1_782_804_484_836,
                  durationMs: 40_801,
                  focusTag: 'none',
                  id: 'step-661aa234-51d7-47c2-b192-0819a0e56cfe:1782804484836',
                  stepId: 'step-661aa234-51d7-47c2-b192-0819a0e56cfe',
                  stepType: 'work'
                }
              ],
              version: 1
            })
          )
        }
      ],
      remove,
      style: {},
      type: ''
    };
    globalThis.document = {
      body: {
        append
      },
      createElement(tagName) {
        expect(tagName).toBe('input');
        return input;
      }
    };
    const { deps, spies, state } = createDeps();
    const { handlers } = createRootActionHandlers(deps);

    handlers['import-focus-history'](createActionButton());
    changeHandler();
    await flushPromises();

    expect(input.accept).toBe('application/json,.json');
    expect(input.type).toBe('file');
    expect(append).toHaveBeenCalledWith(input);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(state.focusHistory).toHaveLength(1);
    expect(state.historyImportNotice).toBe('Imported 1 entries. Skipped 0 duplicates.');
    expect(spies.persistFocusHistory).toHaveBeenCalledTimes(1);
    expect(spies.renderApp).toHaveBeenCalledTimes(1);
  });

  it('keeps no-op behavior for missing datasets and unrelated modal confirmations', () => {
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
    handlers['clear-history-entry'](createActionButton());
    handlers['toggle-history-entry-note-edit'](createActionButton());
    handlers['toggle-history-entry-tag-edit'](createActionButton());
    handlers['set-history-entry-focus-tag'](createActionButton({ entryId: 'focus-1' }));
    handlers['confirm-clear-history-entry'](createActionButton());
    handlers['confirm-reset-run'](createActionButton());

    expect(spies.postWorkerAction).not.toHaveBeenCalled();
    expect(spies.persistSettings).not.toHaveBeenCalled();
    expect(spies.persistFocusHistory).not.toHaveBeenCalled();
    expect(spies.persistFocusNoteDraft).not.toHaveBeenCalled();
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
