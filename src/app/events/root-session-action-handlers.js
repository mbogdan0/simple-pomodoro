// @ts-check

import { WORKER_ACTIONS } from '../../core/worker-protocol.js';
import { ROOT_ACTIONS, ROOT_TABS } from './root-contracts.js';

const END_STEP_EARLY_CONFIRMATION_MESSAGE = 'End the current step now?';
const RESET_CONFIRMATION_MESSAGE = 'Reset all steps and return to the first step?';

export function createRootSessionActionHandlers({
  clearFocusNoteDraft,
  closeOverflowActionsMenu,
  persistSettings,
  playUiActionTone,
  postWorkerAction,
  renderApp,
  state
}) {
  return {
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
    }
  };
}
