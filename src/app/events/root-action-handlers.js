// @ts-check

import {
  removeFocusHistoryEntry,
  updateFocusHistoryEntryFocusTag
} from '../../core/focus-history.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';

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
    persistSettings,
    postWorkerAction,
    renderApp,
    state,
    toggleManualPipWindow
  } = deps;

  function playUiActionTone() {
    audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
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
    'clear-history-entry': (button) => {
      const entryId = button?.dataset?.entryId;

      if (!entryId) {
        return;
      }

      state.focusHistory = removeFocusHistoryEntry(state.focusHistory, entryId);

      if (state.historyTagEditEntryId === entryId) {
        state.historyTagEditEntryId = '';
      }

      persistFocusHistory(state);
      renderApp();
    },
    'end-step-early': (button) => {
      closeOverflowActionsMenu(button);

      if (!window.confirm(END_STEP_EARLY_CONFIRMATION_MESSAGE)) {
        return;
      }

      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.END_STEP_EARLY);
    },
    'pause-step': () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.PAUSE);
    },
    'request-notification-permission': () => {
      void notificationService.requestNotificationPermission().then(() => {
        renderApp();
      });
    },
    'reset-session': (button) => {
      closeOverflowActionsMenu(button);

      if (!window.confirm(RESET_CONFIRMATION_MESSAGE)) {
        return;
      }

      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.RESET_ALL, { settings: state.settings });
    },
    'resume-step': () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.RESUME);
    },
    'set-focus-tag': (button) => {
      const focusTag = button?.dataset?.focusTag;

      if (!focusTag) {
        return;
      }

      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.SET_FOCUS_TAG, { focusTag });
    },
    'set-history-entry-focus-tag': (button) => {
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
    'start-step': () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.START_STEP, { settings: state.settings });
    },
    'switch-tab': (button) => {
      const tab = button?.dataset?.tab;

      if (tab !== 'timer' && tab !== 'settings' && tab !== 'history') {
        return;
      }

      playUiActionTone();
      state.settings.lastOpenTab = tab;
      persistSettings(state);
      renderApp();
    },
    'test-notification': () => {
      void notificationService.testNotification().then(() => {
        renderApp();
      });
    },
    'test-ntfy': () => {
      void testNtfy();
    },
    'test-sound': () => {
      testSound();
    },
    'toggle-history-entry-tag-edit': (button) => {
      const entryId = button?.dataset?.entryId;

      if (!entryId) {
        return;
      }

      state.historyTagEditEntryId = state.historyTagEditEntryId === entryId ? '' : entryId;
      renderApp();
    },
    'toggle-pip-window': () => {
      playUiActionTone();
      void toggleManualPipWindow();
    }
  };

  return {
    handlers,
    playUiActionTone
  };
}
