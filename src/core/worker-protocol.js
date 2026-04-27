// @ts-check

/**
 * @typedef {ReturnType<import('./settings.js').createDefaultSettings>} SettingsModel
 */

/**
 * @typedef {object} WorkerInitPayload
 * @property {object} session
 */

/**
 * @typedef {object} WorkerResetAllPayload
 * @property {SettingsModel} [settings]
 */

/**
 * @typedef {object} WorkerSetFocusTagPayload
 * @property {string} [focusTag]
 */

/**
 * @typedef {object} WorkerSetIdleReminderPayload
 * @property {boolean} enabled
 */

/**
 * @typedef {object} WorkerStartStepPayload
 * @property {SettingsModel} [settings]
 */

/**
 * @typedef {object} WorkerSyncNowPayload
 * @property {number} [now]
 */

/**
 * @typedef {object} WorkerActionPayloadByType
 * @property {WorkerInitPayload} INIT
 * @property {object} END_STEP_EARLY
 * @property {object} PAUSE
 * @property {WorkerResetAllPayload} RESET_ALL
 * @property {object} RESUME
 * @property {WorkerSetFocusTagPayload} SET_FOCUS_TAG
 * @property {WorkerSetIdleReminderPayload} SET_IDLE_REMINDER
 * @property {WorkerStartStepPayload} START_STEP
 * @property {WorkerSyncNowPayload} SYNC_NOW
 */

export const WORKER_ACTIONS = {
  INIT: 'INIT',
  END_STEP_EARLY: 'END_STEP_EARLY',
  PAUSE: 'PAUSE',
  RESET_ALL: 'RESET_ALL',
  RESUME: 'RESUME',
  SET_FOCUS_TAG: 'SET_FOCUS_TAG',
  SET_IDLE_REMINDER: 'SET_IDLE_REMINDER',
  START_STEP: 'START_STEP',
  SYNC_NOW: 'SYNC_NOW'
};

export const WORKER_MESSAGE_TYPES = {
  ERROR: 'ERROR',
  IDLE_REMINDER: 'IDLE_REMINDER',
  STATE: 'STATE',
  STEP_FINISHED: 'STEP_FINISHED',
  TICK: 'TICK'
};

const WORKER_ACTION_SET = new Set(Object.values(WORKER_ACTIONS));
const WORKER_MESSAGE_TYPE_SET = new Set(Object.values(WORKER_MESSAGE_TYPES));

export function isWorkerActionType(value) {
  return WORKER_ACTION_SET.has(value);
}

export function isWorkerMessageType(value) {
  return WORKER_MESSAGE_TYPE_SET.has(value);
}
