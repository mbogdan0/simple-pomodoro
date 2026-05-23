// @ts-check

import { createRootActionHandlers } from './root-action-handlers.js';
import { createRootSettingsHandlers } from './root-settings-handlers.js';
import { updateFocusHistoryEntryFocusNote } from '../../core/focus-history.js';
import { normalizeFocusNote } from '../../core/focus-note.js';

function closeAllOverflowActionsMenus(root) {
  if (typeof root.querySelectorAll !== 'function') {
    return;
  }

  root.querySelectorAll('.overflow-actions[open]').forEach((menu) => {
    menu.open = false;
  });
}

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootEvents(deps) {
  const { persistFocusHistory, persistFocusNoteDraft, root, state } = deps;
  const { handlers: actionHandlers, playUiActionTone } = createRootActionHandlers(deps);
  const settingsHandlers = createRootSettingsHandlers(deps);

  function handleRootClick(event) {
    const target = event?.target;
    const clickedInsideOverflowMenu = Boolean(target?.closest?.('.overflow-actions'));

    if (!clickedInsideOverflowMenu) {
      closeAllOverflowActionsMenus(root);
    }

    if (target?.closest?.('.action-button--overflow')) {
      playUiActionTone();
    }

    const button = target?.closest?.('[data-action]');

    if (!button) {
      return;
    }

    const action = button?.dataset?.action;

    if (!action) {
      return;
    }

    const actionHandler = actionHandlers[action];

    if (typeof actionHandler === 'function') {
      actionHandler(button);
    }
  }

  function handleDocumentClick(event) {
    const target = event?.target;

    if (target?.closest?.('.overflow-actions')) {
      return;
    }

    closeAllOverflowActionsMenus(root);
  }

  function handleRootInput(event) {
    const target = event?.target;

    if (typeof HTMLInputElement === 'undefined' || !(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.matches('[data-focus-note-input]')) {
      const normalizedFocusNote = normalizeFocusNote(target.value);

      if (target.value !== normalizedFocusNote) {
        target.value = normalizedFocusNote;
      }

      if (state.focusNoteDraft === normalizedFocusNote) {
        return;
      }

      state.focusNoteDraft = normalizedFocusNote;
      persistFocusNoteDraft(state);
      return;
    }

    if (!target.matches('[data-history-entry-focus-note-input]')) {
      return;
    }

    const entryId = target.dataset.entryId;

    if (!entryId) {
      return;
    }

    const normalizedFocusNote = normalizeFocusNote(target.value);

    if (target.value !== normalizedFocusNote) {
      target.value = normalizedFocusNote;
    }

    const currentEntry = state.focusHistory.find((entry) => entry.id === entryId);
    const currentFocusNote = normalizeFocusNote(currentEntry?.focusNote);

    if (currentFocusNote === normalizedFocusNote) {
      return;
    }

    state.focusHistory = updateFocusHistoryEntryFocusNote(
      state.focusHistory,
      entryId,
      normalizedFocusNote
    );
    persistFocusHistory(state);
  }

  function bindRootEvents() {
    root.addEventListener('click', handleRootClick);
    root.addEventListener('change', settingsHandlers.handleRootChange);
    root.addEventListener('input', handleRootInput);
    document.addEventListener('click', handleDocumentClick);
  }

  return {
    bindRootEvents,
    handleRootInput,
    handleRootChange: settingsHandlers.handleRootChange,
    handleRootClick
  };
}
