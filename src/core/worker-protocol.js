export const WORKER_ACTIONS = {
  INIT: 'INIT',
  PAUSE: 'PAUSE',
  RESET_ALL: 'RESET_ALL',
  RESUME: 'RESUME',
  SET_FOCUS_TAG: 'SET_FOCUS_TAG',
  START_STEP: 'START_STEP',
  SYNC_NOW: 'SYNC_NOW'
};

export const WORKER_MESSAGE_TYPES = {
  ERROR: 'ERROR',
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
