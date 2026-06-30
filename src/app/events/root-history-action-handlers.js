// @ts-check

import {
  removeFocusHistoryEntry,
  updateFocusHistoryEntryFocusTag
} from '../../core/focus-history.js';
import { ROOT_ACTIONS } from './root-contracts.js';

export function createRootHistoryActionHandlers({ persistFocusHistory, renderApp, state }) {
  function clearHistoryEntry(entryId) {
    state.focusHistory = removeFocusHistoryEntry(state.focusHistory, entryId);

    if (state.historyTagEditEntryId === entryId) {
      state.historyTagEditEntryId = '';
    }

    if (state.historyNoteEditEntryId === entryId) {
      state.historyNoteEditEntryId = '';
    }

    persistFocusHistory(state);
    renderApp();
  }

  return {
    [ROOT_ACTIONS.CLEAR_HISTORY_ENTRY]: (button) => {
      const entryId = button?.dataset?.entryId;

      if (!entryId) {
        return;
      }

      state.modal = {
        entryId,
        type: 'clear-history-entry'
      };
      renderApp();
    },
    [ROOT_ACTIONS.CONFIRM_CLEAR_HISTORY_ENTRY]: () => {
      if (state.modal?.type !== 'clear-history-entry' || !state.modal.entryId) {
        return;
      }

      const entryId = state.modal.entryId;
      state.modal = null;
      clearHistoryEntry(entryId);
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
    }
  };
}
