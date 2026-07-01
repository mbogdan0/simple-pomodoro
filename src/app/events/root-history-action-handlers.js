// @ts-check

import {
  createFocusHistoryExportPayload,
  removeFocusHistoryEntry,
  updateFocusHistoryEntryFocusTag
} from '../../core/focus-history.js';
import { importFocusHistoryFile } from './root-history-change-handlers.js';
import { ROOT_ACTIONS } from './root-contracts.js';

function createExportFileName(exportedAt) {
  return `simple-pomodoro-history-${new Date(exportedAt).toISOString().slice(0, 10)}.json`;
}

function downloadJsonFile(payload, fileName) {
  if (
    typeof Blob === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return false;
  }

  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body?.append?.(anchor);
  anchor.click?.();
  anchor.remove?.();
  URL.revokeObjectURL?.(url);

  return true;
}

export function createRootHistoryActionHandlers({
  persistFocusHistory,
  persistFocusHistoryLastExportedAt,
  renderApp,
  state
}) {
  function clearHistoryEntry(entryId) {
    state.focusHistory = removeFocusHistoryEntry(state.focusHistory, entryId);

    if (state.historyTagEditEntryId === entryId) {
      state.historyTagEditEntryId = '';
    }

    if (state.historyNoteEditEntryId === entryId) {
      state.historyNoteEditEntryId = '';
    }

    state.historyImportNotice = '';
    persistFocusHistory(state);
    renderApp();
  }

  function exportFocusHistory() {
    if (!state.focusHistory.length) {
      return;
    }

    const exportedAt = Date.now();
    const payload = createFocusHistoryExportPayload(state.focusHistory, exportedAt);
    const didStartDownload = downloadJsonFile(payload, createExportFileName(exportedAt));

    if (!didStartDownload) {
      state.modal = {
        message: 'History export is not available in this browser.',
        title: 'Export failed',
        type: 'history-message'
      };
      renderApp();
      return;
    }

    state.lastFocusHistoryExportedAt = exportedAt;
    state.historyImportNotice = '';
    persistFocusHistoryLastExportedAt(state);
    renderApp();
  }

  function importFocusHistory() {
    if (typeof document === 'undefined') {
      return;
    }

    const input = document.createElement('input');
    input.accept = 'application/json,.json';
    input.type = 'file';
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0] ?? null;

        void importFocusHistoryFile(file, {
          persistFocusHistory,
          renderApp,
          state
        }).finally(() => {
          input.remove?.();
        });
      },
      { once: true }
    );
    input.style.display = 'none';
    document.body?.append?.(input);
    input.click();
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
    [ROOT_ACTIONS.EXPORT_FOCUS_HISTORY]: () => {
      exportFocusHistory();
    },
    [ROOT_ACTIONS.IMPORT_FOCUS_HISTORY]: () => {
      importFocusHistory();
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
      state.historyImportNotice = '';
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
