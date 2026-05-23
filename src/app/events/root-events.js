// @ts-check

import { createRootActionHandlers } from './root-action-handlers.js';
import { createRootSettingsHandlers } from './root-settings-handlers.js';
import { updateFocusHistoryEntryFocusNote } from '../../core/focus-history.js';
import { normalizeFocusNote } from '../../core/focus-note.js';

function closeAllCollapsibleMenus(root) {
  if (typeof root.querySelectorAll !== 'function') {
    return;
  }

  root.querySelectorAll('.overflow-actions[open], .history-edit-menu[open]').forEach((menu) => {
    menu.open = false;
  });
}

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootEvents(deps) {
  const { persistFocusHistory, persistFocusNoteDraft, renderApp, root, state } = deps;
  const { handlers: actionHandlers, playUiActionTone } = createRootActionHandlers(deps);
  const settingsHandlers = createRootSettingsHandlers(deps);
  let isBound = false;

  function closeActiveHistoryEditors() {
    if (!state.historyTagEditEntryId && !state.historyNoteEditEntryId) {
      return false;
    }

    state.historyTagEditEntryId = '';
    state.historyNoteEditEntryId = '';
    return true;
  }

  function handleRootClick(event) {
    const target = event?.target;
    const clickedInsideOverflowMenu = Boolean(
      target?.closest?.('.overflow-actions, .history-edit-menu')
    );

    if (!clickedInsideOverflowMenu) {
      closeAllCollapsibleMenus(root);
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
    const clickedInsideOverflowMenu = Boolean(
      target?.closest?.('.overflow-actions, .history-edit-menu')
    );

    if (clickedInsideOverflowMenu) {
      return;
    }

    closeAllCollapsibleMenus(root);

    if (target?.closest?.('.history-item')) {
      return;
    }

    if (closeActiveHistoryEditors()) {
      renderApp();
    }
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
    if (isBound) {
      return;
    }

    root.addEventListener('click', handleRootClick);
    root.addEventListener('change', settingsHandlers.handleRootChange);
    root.addEventListener('input', handleRootInput);
    document.addEventListener('click', handleDocumentClick);
    isBound = true;
  }

  function dispose() {
    if (!isBound) {
      return;
    }

    root.removeEventListener?.('click', handleRootClick);
    root.removeEventListener?.('change', settingsHandlers.handleRootChange);
    root.removeEventListener?.('input', handleRootInput);
    document.removeEventListener?.('click', handleDocumentClick);
    isBound = false;
  }

  return {
    bindRootEvents,
    dispose,
    handleRootInput,
    handleRootChange: settingsHandlers.handleRootChange,
    handleRootClick
  };
}
