// @ts-check

import { isBreakStep, isWorkStep } from '../../core/session.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';
import { ROOT_ACTIONS, ROOT_TABS } from './root-contracts.js';

function openModal(state, renderApp, modal) {
  state.modal = modal;
  renderApp();
}

function closeModal(state, renderApp) {
  if (!state.modal) {
    return;
  }

  state.modal = null;
  renderApp();
}

export function createRootSessionActionHandlers({
  clearFocusNoteDraft,
  closeOverflowActionsMenu,
  persistSettings,
  playUiActionTone,
  postWorkerAction,
  renderApp,
  state
}) {
  function postAdvanceFocus(historySaveMode) {
    const focusNote = state.focusNoteDraft;
    state.modal = null;
    clearFocusNoteDraft();
    renderApp();
    playUiActionTone();
    postWorkerAction(WORKER_ACTIONS.ADVANCE_FOCUS, {
      focusNote,
      historySaveMode,
      settings: state.settings
    });
  }

  function postResetRun() {
    state.modal = null;
    clearFocusNoteDraft();
    renderApp();
    playUiActionTone();
    postWorkerAction(WORKER_ACTIONS.RESET_RUN, { settings: state.settings });
  }

  return {
    [ROOT_ACTIONS.ADVANCE_BREAK]: () => {
      if (!isBreakStep(state.activeSession)) {
        return;
      }

      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.ADVANCE_BREAK, { settings: state.settings });
    },
    [ROOT_ACTIONS.CANCEL_MODAL]: () => {
      closeModal(state, renderApp);
    },
    [ROOT_ACTIONS.CONFIRM_RESET_RUN]: () => {
      if (state.modal?.type !== 'reset-run') {
        return;
      }

      postResetRun();
    },
    [ROOT_ACTIONS.CONFIRM_STALE_SESSION_RESET]: () => {
      if (state.modal?.type !== 'stale-session') {
        return;
      }

      postResetRun();
    },
    [ROOT_ACTIONS.PAUSE_STEP]: () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.PAUSE);
    },
    [ROOT_ACTIONS.RESET_RUN]: (button) => {
      closeOverflowActionsMenu(button);
      openModal(state, renderApp, { type: 'reset-run' });
    },
    [ROOT_ACTIONS.RESUME_STEP]: () => {
      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.RESUME);
    },
    [ROOT_ACTIONS.SAVE_FOCUS_ACTUAL]: () => {
      if (state.modal?.type !== 'focus-save') {
        return;
      }

      postAdvanceFocus('actual');
    },
    [ROOT_ACTIONS.SAVE_FOCUS_PLANNED]: () => {
      if (state.modal?.type !== 'focus-save') {
        return;
      }

      postAdvanceFocus('planned');
    },
    [ROOT_ACTIONS.SET_FOCUS_TAG]: (button) => {
      const focusTag = button?.dataset?.focusTag;

      if (!focusTag) {
        return;
      }

      playUiActionTone();
      postWorkerAction(WORKER_ACTIONS.SET_FOCUS_TAG, { focusTag });
    },
    [ROOT_ACTIONS.SKIP_FOCUS_HISTORY]: () => {
      if (state.modal?.type !== 'focus-save') {
        return;
      }

      postAdvanceFocus('skip');
    },
    [ROOT_ACTIONS.START_BREAK]: () => {
      if (!isWorkStep(state.activeSession)) {
        return;
      }

      openModal(state, renderApp, { type: 'focus-save' });
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
