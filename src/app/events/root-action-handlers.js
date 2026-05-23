// @ts-check

import {
  removeFocusHistoryEntry,
  updateFocusHistoryEntryFocusTag
} from '../../core/focus-history.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';
import { ROOT_ACTIONS, ROOT_TABS } from './root-contracts.js';

const RESET_CONFIRMATION_MESSAGE = 'Reset all steps and return to the first step?';
const END_STEP_EARLY_CONFIRMATION_MESSAGE = 'End the current step now?';

function closeOverflowActionsMenu(button) {
  const parentDetails = button.closest?.('details');

  if (parentDetails && typeof parentDetails === 'object' && 'open' in parentDetails) {
    parentDetails.open = false;
  }
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

  async function testNtfy() {
    if (state.isNtfyTesting) {
      return;
    }

    if (!state.settings.ntfyPublishUrl) {
      state.ntfyNotice = 'Set a valid ntfy publish URL first.';
      renderApp();
      return;
    }

    state.isNtfyTesting = true;
    renderApp();

    try {
      await notificationService.testNtfy();
    } finally {
      state.isNtfyTesting = false;
    }

    renderApp();
  }

  /** @type {Record<import('./root-event-types.js').RootActionName, (button: import('./root-event-types.js').RootActionElement) => void>} */
  const handlers = {
    [ROOT_ACTIONS.CLEAR_HISTORY_ENTRY]: (button) => {
      const entryId = button?.dataset?.entryId;

      if (!entryId) {
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
    [ROOT_ACTIONS.END_STEP_EARLY]: (button) => {
      closeOverflowActionsMenu(button);

      if (!window.confirm(END_STEP_EARLY_CONFIRMATION_MESSAGE)) {
        return;
      }

      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.END_STEP_EARLY);
    },
    [ROOT_ACTIONS.PAUSE_STEP]: () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.PAUSE);
    },
    [ROOT_ACTIONS.REQUEST_NOTIFICATION_PERMISSION]: () => {
      void notificationService.requestNotificationPermission().then(() => {
        renderApp();
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
      persistFocusHistory(state);
      renderApp();
    },
    [ROOT_ACTIONS.TOGGLE_HISTORY_ENTRY_NOTE_EDIT]: (button) => {
      const entryId = button?.dataset?.entryId;

      if (!entryId) {
        return;
      }

      state.historyNoteEditEntryId = state.historyNoteEditEntryId === entryId ? '' : entryId;
      renderApp();
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
      void notificationService.testNotification().then(() => {
        renderApp();
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

      state.historyTagEditEntryId = state.historyTagEditEntryId === entryId ? '' : entryId;
      renderApp();
    },
    [ROOT_ACTIONS.TOGGLE_PIP_WINDOW]: () => {
      playUiActionTone();
      void toggleManualPipWindow();
    }
  };

  return {
    handlers,
    playUiActionTone
  };
}
