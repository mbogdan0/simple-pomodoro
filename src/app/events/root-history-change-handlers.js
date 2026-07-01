// @ts-check

import { mergeFocusHistory, parseFocusHistoryImportPayload } from '../../core/focus-history.js';

function createImportResultMessage(addedCount, skippedCount) {
  if (addedCount === 0 && skippedCount === 0) {
    return 'No valid focus history entries were imported.';
  }

  return `Imported ${addedCount} entries. Skipped ${skippedCount} duplicates.`;
}

async function readImportFile(file) {
  if (!file || typeof file.text !== 'function') {
    throw new Error('Choose a JSON backup file to import.');
  }

  return JSON.parse(await file.text());
}

export async function importFocusHistoryFile(file, { persistFocusHistory, renderApp, state }) {
  try {
    const payload = await readImportFile(file);
    const parsed = parseFocusHistoryImportPayload(payload);

    if (parsed.error) {
      state.historyImportNotice = parsed.error;
      state.modal = {
        message: parsed.error,
        title: 'Import failed',
        type: 'history-message'
      };
      renderApp();
      return true;
    }

    const mergeResult = mergeFocusHistory(state.focusHistory, parsed.focusHistory);
    state.focusHistory = mergeResult.history;
    state.historyNoteEditEntryId = '';
    state.historyTagEditEntryId = '';
    persistFocusHistory(state);
    state.historyImportNotice = createImportResultMessage(
      mergeResult.addedCount,
      mergeResult.skippedCount
    );
    state.modal = {
      message: state.historyImportNotice,
      title: 'Import complete',
      type: 'history-message'
    };
    renderApp();
    return true;
  } catch {
    state.historyImportNotice = 'Choose a valid JSON focus history backup file.';
    state.modal = {
      message: state.historyImportNotice,
      title: 'Import failed',
      type: 'history-message'
    };
    renderApp();
    return true;
  }
}

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootHistoryChangeHandlers(deps) {
  const { persistFocusHistory, renderApp, state } = deps;

  async function handleFocusHistoryImportInput(target) {
    const file = target.files?.[0] ?? null;

    try {
      return await importFocusHistoryFile(file, {
        persistFocusHistory,
        renderApp,
        state
      });
    } finally {
      target.value = '';
    }
  }

  /**
   * @param {Event} event
   */
  function handleRootChange(event) {
    const target = event.target;

    if (
      !target ||
      typeof target !== 'object' ||
      !('matches' in target) ||
      typeof target.matches !== 'function' ||
      !target.matches('[data-focus-history-import-input]')
    ) {
      return false;
    }

    void handleFocusHistoryImportInput(target);
    return true;
  }

  return {
    handleFocusHistoryImportInput,
    handleRootChange
  };
}
