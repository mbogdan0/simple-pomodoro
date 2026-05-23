export const ROOT_ACTIONS = Object.freeze({
  CLEAR_HISTORY_ENTRY: 'clear-history-entry',
  END_STEP_EARLY: 'end-step-early',
  PAUSE_STEP: 'pause-step',
  REQUEST_NOTIFICATION_PERMISSION: 'request-notification-permission',
  RESET_SESSION: 'reset-session',
  RESUME_STEP: 'resume-step',
  SET_FOCUS_TAG: 'set-focus-tag',
  SET_HISTORY_ENTRY_FOCUS_TAG: 'set-history-entry-focus-tag',
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

export const ROOT_TAB_VALUES = Object.freeze(Object.values(ROOT_TABS));

export const ALERT_SETTING_KEYS = Object.freeze({
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  SOUND_ENABLED: 'soundEnabled'
});

export const ALERT_SETTING_VALUES = Object.freeze(Object.values(ALERT_SETTING_KEYS));

export const SETTING_TOGGLE_KEYS = Object.freeze({
  AUTO_START_NEXT_STEP: 'autoStartNextStep',
  IDLE_REMINDER_ENABLED: 'idleReminderEnabled',
  PIP_CLOCK_TICK_EVERY_10S: 'pipClockTickEvery10s'
});

export const SETTING_TOGGLE_VALUES = Object.freeze(Object.values(SETTING_TOGGLE_KEYS));
