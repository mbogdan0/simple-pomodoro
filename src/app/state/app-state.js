import { normalizeSession } from '../../core/session.js';
import {
  loadActiveSession,
  loadFocusHistory,
  loadSettings,
  saveActiveSession,
  saveFocusHistory,
  saveSettings
} from '../../core/storage.js';

export function createAppState() {
  const state = {
    activeSession: null,
    backgroundNotice: '',
    focusHistory: loadFocusHistory(),
    historyTagEditEntryId: '',
    idleStartedAt: null,
    isNtfyTesting: false,
    lastCompletionKey: '',
    lastFocusMinuteReminderKey: '',
    lastIdleReminderAt: Date.now(),
    manualPipRequested: false,
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
