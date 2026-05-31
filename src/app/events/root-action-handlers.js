// @ts-check

import {
  removeFocusHistoryEntry,
  updateFocusHistoryEntryFocusTag
} from '../../core/focus-history.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';
import { ROOT_ACTIONS, ROOT_TABS } from './root-contracts.js';

const RESET_CONFIRMATION_MESSAGE = 'Reset all steps and return to the first step?';
const END_STEP_EARLY_CONFIRMATION_MESSAGE = 'End the current step now?';
const CLEAR_HISTORY_ENTRY_CONFIRMATION_MESSAGE = 'Clear this history entry?';

function closeOverflowActionsMenu(button) {
  const parentDetails = button.closest?.('details');

  if (parentDetails && typeof parentDetails === 'object' && 'open' in parentDetails) {
    parentDetails.open = false;
  }
}

function runAsyncAction(task, { onAfter = null, onBefore = null } = {}) {
  onBefore?.();

  void Promise.resolve()
    .then(task)
    .catch(() => {})
    .finally(() => {
      onAfter?.();
    });
}

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootActionHandlers(deps) {
  const {
    audioService,
    notificationService,
    persistFocusHistory,
    persistFocusNoteDraft,
    persistSettings,
    postWorkerAction,
    renderApp,
    state,
    toggleManualPipWindow
  } = deps;

  function playUiActionTone() {
    audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
  }

  function clearFocusNoteDraft() {
    state.focusNoteDraft = '';
    persistFocusNoteDraft(state);
  }

  function testSound() {
    const played = audioService.playCompletionTone();
    state.notificationNotice = played
      ? 'Test sound played successfully.'
      : 'Sound playback is unavailable in this browser.';
    renderApp();
  }

  function testNtfy() {
    if (state.isNtfyTesting) {
      return;
    }

    if (!state.settings.ntfyPublishUrl) {
      state.ntfyNotice = 'Set a valid ntfy publish URL first.';
      renderApp();
      return;
    }

    runAsyncAction(() => notificationService.testNtfy(), {
      onAfter: () => {
        state.isNtfyTesting = false;
        renderApp();
      },
      onBefore: () => {
        state.isNtfyTesting = true;
        renderApp();
      }
    });
  }

  /** @type {Record<import('./root-event-types.js').RootActionName, (button: import('./root-event-types.js').RootActionElement) => void>} */
  const handlers = {
    [ROOT_ACTIONS.CLEAR_HISTORY_ENTRY]: (button) => {
      const entryId = button?.dataset?.entryId;

      if (!entryId) {
        return;
      }

      if (!window.confirm(CLEAR_HISTORY_ENTRY_CONFIRMATION_MESSAGE)) {
        return;
      }

      state.focusHistory = removeFocusHistoryEntry(state.focusHistory, entryId);

      if (state.historyTagEditEntryId === entryId) {
        state.historyTagEditEntryId = '';
      }
      if (state.historyNoteEditEntryId === entryId) {
        state.historyNoteEditEntryId = '';
      }

      persistFocusHistory(state);
      renderApp();
    },
    [ROOT_ACTIONS.DISCARD_FREE_TIMER]: (button) => {
      closeOverflowActionsMenu(button);
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.DISCARD_FREE_TIMER, { settings: state.settings });
    },
    [ROOT_ACTIONS.END_STEP_EARLY]: (button) => {
      closeOverflowActionsMenu(button);

      if (!window.confirm(END_STEP_EARLY_CONFIRMATION_MESSAGE)) {
        return;
      }

      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.END_STEP_EARLY);
    },
    [ROOT_ACTIONS.FINISH_FREE_TIMER]: () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.FINISH_FREE_TIMER, {
        focusNote: state.focusNoteDraft,
        settings: state.settings
      });
    },
    [ROOT_ACTIONS.PAUSE_STEP]: () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.PAUSE);
    },
    [ROOT_ACTIONS.REQUEST_NOTIFICATION_PERMISSION]: () => {
      runAsyncAction(() => notificationService.requestNotificationPermission(), {
        onAfter: renderApp
      });
    },
    [ROOT_ACTIONS.RESET_SESSION]: (button) => {
      closeOverflowActionsMenu(button);

      if (!window.confirm(RESET_CONFIRMATION_MESSAGE)) {
        return;
      }

      clearFocusNoteDraft();
      renderApp();
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.RESET_ALL, { settings: state.settings });
    },
    [ROOT_ACTIONS.RESUME_STEP]: () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.RESUME);
    },
    [ROOT_ACTIONS.SET_FOCUS_TAG]: (button) => {
      const focusTag = button?.dataset?.focusTag;

      if (!focusTag) {
        return;
      }

      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.SET_FOCUS_TAG, { focusTag });
    },
    [ROOT_ACTIONS.SET_HISTORY_ENTRY_FOCUS_TAG]: (button) => {
      const entryId = button?.dataset?.entryId;
      const focusTag = button?.dataset?.focusTag;

      if (!entryId || !focusTag) {
        return;
      }

      state.focusHistory = updateFocusHistoryEntryFocusTag(state.focusHistory, entryId, focusTag);
      state.historyTagEditEntryId = '';
      state.historyNoteEditEntryId = '';
      persistFocusHistory(state);
      renderApp();
    },
    [ROOT_ACTIONS.TOGGLE_HISTORY_ENTRY_NOTE_EDIT]: (button) => {
      const entryId = button?.dataset?.entryId;

      if (!entryId) {
        return;
      }

      if (state.historyNoteEditEntryId === entryId) {
        state.historyNoteEditEntryId = '';
      } else {
        state.historyNoteEditEntryId = entryId;
        state.historyTagEditEntryId = '';
      }
      renderApp();
    },
    [ROOT_ACTIONS.START_FREE_TIMER]: (button) => {
      closeOverflowActionsMenu(button);
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.START_FREE_TIMER, { settings: state.settings });
    },
    [ROOT_ACTIONS.START_STEP]: () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.START_STEP, { settings: state.settings });
    },
    [ROOT_ACTIONS.SWITCH_TAB]: (button) => {
      const tab = button?.dataset?.tab;

      if (tab !== ROOT_TABS.TIMER && tab !== ROOT_TABS.SETTINGS && tab !== ROOT_TABS.HISTORY) {
        return;
      }

      playUiActionTone();
      state.settings.lastOpenTab = tab;
      persistSettings(state);
      renderApp();
    },
    [ROOT_ACTIONS.TEST_NOTIFICATION]: () => {
      runAsyncAction(() => notificationService.testNotification(), {
        onAfter: renderApp
      });
    },
    [ROOT_ACTIONS.TEST_NTFY]: () => {
      void testNtfy();
    },
    [ROOT_ACTIONS.TEST_SOUND]: () => {
      testSound();
    },
    [ROOT_ACTIONS.TOGGLE_HISTORY_ENTRY_TAG_EDIT]: (button) => {
      const entryId = button?.dataset?.entryId;

      if (!entryId) {
        return;
      }

      if (state.historyTagEditEntryId === entryId) {
        state.historyTagEditEntryId = '';
      } else {
        state.historyTagEditEntryId = entryId;
        state.historyNoteEditEntryId = '';
      }
      renderApp();
    },
    [ROOT_ACTIONS.TOGGLE_PIP_WINDOW]: () => {
      playUiActionTone();
      runAsyncAction(() => toggleManualPipWindow());
    }
  };

  return {
    handlers,
    playUiActionTone
  };
}
