// @ts-check

import {
  removeFocusHistoryEntry,
  updateFocusHistoryEntryFocusTag
} from '../../core/focus-history.js';
import { ROOT_ACTIONS } from './root-contracts.js';

const CLEAR_HISTORY_ENTRY_CONFIRMATION_MESSAGE = 'Clear this history entry?';

export function createRootHistoryActionHandlers({ persistFocusHistory, renderApp, state }) {
  return {
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
