export const APP_NAME = 'Simple Pomodoro Timer';

export const STEP_TYPES = ['work', 'shortBreak', 'longBreak'];

export const STEP_TYPE_LABELS = {
  work: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break'
};

export const STEP_PALETTE = {
  longBreak: {
    accent: '#3d69c5',
    accentOutline: '#a8b7d8',
    accentSoft: '#e6ebf6'
  },
  shortBreak: {
    accent: '#2f8c73',
    accentOutline: '#a2beb4',
    accentSoft: '#e4efe9'
  },
  work: {
    accent: '#c85a3a',
    accentOutline: '#d0afa3',
    accentSoft: '#f3e7e2'
  }
};

export const PROGRESS_TRACK_COLOR = '#ede7de';

export const TAB_LABELS = {
  timer: 'Timer',
  settings: 'Settings',
  history: 'History'
};

export const STATUS_LABELS = {
  idle: 'Ready',
  running: 'Running',
  paused: 'Paused',
  completed_waiting_next: 'Step complete'
};

export const FOCUS_TAGS = ['none', 'work', 'study'];

export const FOCUS_TAG_LABELS = {
  none: 'Other',
  study: 'Study',
  work: 'Work'
};

export const DEFAULT_TEMPLATE_DURATIONS_MS = {
  work: 25 * 60 * 1000,
  shortBreak: 5 * 60 * 1000,
  longBreak: 15 * 60 * 1000
};

export const DEFAULT_REPEAT_COUNT = 4;
export const MIN_REPEAT_COUNT = 1;
export const MAX_REPEAT_COUNT = 24;
export const DEFAULT_AUTO_START_NEXT_STEP = false;
export const DEFAULT_PIP_CLOCK_TICK_EVERY_10S = false;

export const DEFAULT_ALERT_SETTINGS = {
  notificationsEnabled: true,
  soundEnabled: true
};

export const STORAGE_KEYS = {
  focusHistory: 'timer.focus-history.v1',
  settings: 'timer.settings.v2',
  activeSession: 'timer.active-session.v2'
};
export const MAX_FOCUS_HISTORY_ENTRIES = 500;

export const WORKER_TICK_INTERVAL_MS = 250;
export const BACKGROUND_COMPLETION_THRESHOLD_MS = 1000;
export const MIN_STEP_DURATION_MS = 60 * 1000;
export const MAX_STEP_DURATION_MS = 8 * 60 * 60 * 1000;
