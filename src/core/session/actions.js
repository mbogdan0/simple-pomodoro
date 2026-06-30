import {
  advanceBreakStep,
  advanceFocusStep,
  pauseSession,
  prepareSessionForStepStart,
  resetRun,
  resumeSession,
  setSessionFocusTag
} from './transitions.js';
import { WORKER_ACTIONS } from '../worker-protocol.js';
import { createFocusHistoryEntry } from '../focus-history.js';
import { getCurrentStep, getCurrentStepDurationMs, getElapsedMs } from './queries.js';

const FOCUS_HISTORY_SAVE_MODES = ['actual', 'planned', 'skip'];

function normalizeFocusHistorySaveMode(value) {
  return FOCUS_HISTORY_SAVE_MODES.includes(value) ? value : 'actual';
}

function createAdvanceFocusHistoryEntry(session, payload, now) {
  const historySaveMode = normalizeFocusHistorySaveMode(payload.historySaveMode);

  if (historySaveMode === 'skip') {
    return null;
  }

  const durationMs =
    historySaveMode === 'planned' ? getCurrentStepDurationMs(session) : getElapsedMs(session, now);
  const step = getCurrentStep(session);
  const idHint = `${step?.id ?? 'focus'}:${now}`;

  return createFocusHistoryEntry({
    completedAt: now,
    durationMs,
    focusNote: payload.focusNote,
    idHint,
    session
  });
}

/**
 * @typedef {'keep' | 'start' | 'stop'} ActionTimerMode
 */

/**
 * @typedef {{
 *   completionReason: string,
 *   handled: boolean,
 *   historyEntry: object | null,
 *   nextSession: object,
 *   reason: string,
 *   timerMode: ActionTimerMode
 * }} SessionActionResult
 */

/**
 * @param {object} session
 * @param {string} type
 * @param {object} [payload]
 * @param {{
 *   now?: number,
 *   settings?: object
 * }} [options]
 * @returns {SessionActionResult}
 */
export function applySessionAction(session, type, payload = {}, options = {}) {
  const now = options.now ?? payload.now ?? Date.now();
  const settings = payload.settings ?? options.settings;

  switch (type) {
    case WORKER_ACTIONS.ADVANCE_BREAK:
      return {
        handled: true,
        historyEntry: null,
        completionReason: '',
        nextSession: advanceBreakStep(session, now),
        reason: 'advance-break',
        timerMode: 'start'
      };
    case WORKER_ACTIONS.ADVANCE_FOCUS:
      return {
        completionReason: '',
        handled: true,
        historyEntry: createAdvanceFocusHistoryEntry(session, payload, now),
        nextSession: advanceFocusStep(session, now),
        reason: 'advance-focus',
        timerMode: 'start'
      };
    case WORKER_ACTIONS.PAUSE:
      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession: pauseSession(session, now),
        reason: 'pause',
        timerMode: 'stop'
      };
    case WORKER_ACTIONS.RESET_RUN:
      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession: resetRun(session, settings, now),
        reason: 'reset-run',
        timerMode: 'stop'
      };
    case WORKER_ACTIONS.RESUME:
      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession: resumeSession(session, now),
        reason: 'resume',
        timerMode: 'start'
      };
    case WORKER_ACTIONS.START_STEP:
      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession: prepareSessionForStepStart(session, settings, now),
        reason: 'start',
        timerMode: 'start'
      };
    case WORKER_ACTIONS.SET_FOCUS_TAG:
      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession: setSessionFocusTag(session, payload.focusTag, now),
        reason: 'set-focus-tag',
        timerMode: 'keep'
      };
    default:
      return {
        completionReason: '',
        handled: false,
        historyEntry: null,
        nextSession: session,
        reason: '',
        timerMode: 'keep'
      };
  }
}
