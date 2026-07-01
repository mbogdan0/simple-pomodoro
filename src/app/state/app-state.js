import { normalizeSession } from '../../core/session.js';
import {
  loadActiveSession,
  loadFocusHistory,
  loadFocusHistoryLastExportedAt,
  loadFocusNoteDraft,
  loadSettings,
  saveActiveSession,
  saveFocusHistory,
  saveFocusHistoryLastExportedAt,
  saveFocusNoteDraft,
  saveSettings
} from '../../core/storage.js';

export function createAppState() {
  const state = {
    activeSession: null,
    backgroundNotice: '',
    focusHistory: loadFocusHistory(),
    lastFocusHistoryExportedAt: loadFocusHistoryLastExportedAt(),
    focusNoteDraft: loadFocusNoteDraft(),
    historyNoteEditEntryId: '',
    historyTagEditEntryId: '',
    historyImportNotice: '',
    idleStartedAt: null,
    isNtfyTesting: false,
    lastCompletionKey: '',
    lastFocusMinuteReminderKey: '',
    lastIdleReminderAt: Date.now(),
    lastOvertimeReminderKey: '',
    manualPipRequested: false,
    modal: null,
    notificationNotice: '',
    ntfyNotice: '',
    pauseStartedAt: null,
    serviceWorkerReady: false,
    settings: loadSettings()
  };

  state.activeSession = normalizeSession(loadActiveSession(state.settings), state.settings);
  return state;
}

export function persistSettings(state) {
  saveSettings(state.settings);
}

export function persistSession(state) {
  saveActiveSession(state.activeSession);
}

export function persistFocusHistory(state) {
  saveFocusHistory(state.focusHistory);
}

export function persistFocusHistoryLastExportedAt(state) {
  saveFocusHistoryLastExportedAt(state.lastFocusHistoryExportedAt);
}

export function persistFocusNoteDraft(state) {
  saveFocusNoteDraft(state.focusNoteDraft);
}
