export const ROOT_ACTIONS = Object.freeze({
  ADVANCE_BREAK: 'advance-break',
  CANCEL_MODAL: 'cancel-modal',
  CLEAR_HISTORY_ENTRY: 'clear-history-entry',
  CONFIRM_CLEAR_HISTORY_ENTRY: 'confirm-clear-history-entry',
  CONFIRM_RESET_RUN: 'confirm-reset-run',
  CONFIRM_STALE_SESSION_RESET: 'confirm-stale-session-reset',
  EXPORT_FOCUS_HISTORY: 'export-focus-history',
  IMPORT_FOCUS_HISTORY: 'import-focus-history',
  PAUSE_STEP: 'pause-step',
  REQUEST_NOTIFICATION_PERMISSION: 'request-notification-permission',
  RESET_RUN: 'reset-run',
  RESUME_STEP: 'resume-step',
  SAVE_FOCUS_ACTUAL: 'save-focus-actual',
  SAVE_FOCUS_PLANNED: 'save-focus-planned',
  SET_FOCUS_TAG: 'set-focus-tag',
  SET_HISTORY_ENTRY_FOCUS_TAG: 'set-history-entry-focus-tag',
  SKIP_FOCUS_HISTORY: 'skip-focus-history',
  START_BREAK: 'start-break',
  START_STEP: 'start-step',
  SWITCH_TAB: 'switch-tab',
  TEST_NOTIFICATION: 'test-notification',
  TEST_NTFY: 'test-ntfy',
  TEST_SOUND: 'test-sound',
  TOGGLE_HISTORY_ENTRY_NOTE_EDIT: 'toggle-history-entry-note-edit',
  TOGGLE_HISTORY_ENTRY_TAG_EDIT: 'toggle-history-entry-tag-edit',
  TOGGLE_PIP_WINDOW: 'toggle-pip-window'
});

export const ROOT_TABS = Object.freeze({
  HISTORY: 'history',
  SETTINGS: 'settings',
  TIMER: 'timer'
});

export const ALERT_SETTING_KEYS = Object.freeze({
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  SOUND_ENABLED: 'soundEnabled'
});

export const SETTING_TOGGLE_KEYS = Object.freeze({
  IDLE_REMINDER_ENABLED: 'idleReminderEnabled',
  INFINITE_CYCLE_ENABLED: 'infiniteCycleEnabled',
  PIP_CLOCK_TICK_EVERY_10S: 'pipClockTickEvery10s'
});
