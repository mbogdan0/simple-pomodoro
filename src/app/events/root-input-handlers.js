// @ts-check

import { updateFocusHistoryEntryFocusNote } from '../../core/focus-history.js';
import { normalizeFocusNote } from '../../core/focus-note.js';

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootInputHandlers(deps) {
  const { persistFocusHistory, persistFocusNoteDraft, state } = deps;

  function handleFocusNoteDraftInput(target) {
    const normalizedFocusNote = normalizeFocusNote(target.value);

    if (target.value !== normalizedFocusNote) {
      target.value = normalizedFocusNote;
    }

    if (state.focusNoteDraft === normalizedFocusNote) {
      return;
    }

    state.focusNoteDraft = normalizedFocusNote;
    persistFocusNoteDraft(state);
  }

  function handleHistoryFocusNoteInput(target) {
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

  function handleRootInput(event) {
    const target = event?.target;

    if (typeof HTMLInputElement === 'undefined' || !(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.matches('[data-focus-note-input]')) {
      handleFocusNoteDraftInput(target);
      return;
    }

    if (!target.matches('[data-history-entry-focus-note-input]')) {
      return;
    }

    handleHistoryFocusNoteInput(target);
  }

  return {
    handleRootInput
  };
}
