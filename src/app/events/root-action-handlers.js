// @ts-check

import { createRootDiagnosticsActionHandlers } from './root-diagnostics-action-handlers.js';
import { createRootHistoryActionHandlers } from './root-history-action-handlers.js';
import { createRootSessionActionHandlers } from './root-session-action-handlers.js';

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

  /** @type {Record<import('./root-event-types.js').RootActionName, (button: import('./root-event-types.js').RootActionElement) => void>} */
  const handlers = {
    ...createRootHistoryActionHandlers({
      persistFocusHistory,
      renderApp,
      state
    }),
    ...createRootSessionActionHandlers({
      clearFocusNoteDraft,
      closeOverflowActionsMenu,
      persistSettings,
      playUiActionTone,
      postWorkerAction,
      renderApp,
      state
    }),
    ...createRootDiagnosticsActionHandlers({
      notificationService,
      playCompletionTone: audioService.playCompletionTone,
      playUiActionTone,
      renderApp,
      runAsyncAction,
      state,
      toggleManualPipWindow
    })
  };

  return {
    handlers,
    playUiActionTone
  };
}
