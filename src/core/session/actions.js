import {
  forceCompleteCurrentStep,
  pauseSession,
  prepareSessionForStepStart,
  resetSession,
  resumeSession,
  setSessionFocusTag
} from './transitions.js';
import { syncIdleSessionWithSettings } from './normalize.js';
import { WORKER_ACTIONS } from '../worker-protocol.js';

/**
 * @typedef {'keep' | 'start' | 'stop'} ActionTimerMode
 */

/**
 * @typedef {{
 *   completionReason: string,
 *   handled: boolean,
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
    case WORKER_ACTIONS.END_STEP_EARLY:
      return {
        completionReason: 'manual_early',
        handled: true,
        nextSession: forceCompleteCurrentStep(session, now),
        reason: 'end-step-early',
        timerMode: 'stop'
      };
    case WORKER_ACTIONS.PAUSE:
      return {
        completionReason: '',
        handled: true,
        nextSession: pauseSession(session, now),
        reason: 'pause',
        timerMode: 'stop'
      };
    case WORKER_ACTIONS.RESET_ALL: {
      const reset = resetSession(session, now);
      return {
        completionReason: '',
        handled: true,
        nextSession: settings ? syncIdleSessionWithSettings(reset, settings, now) : reset,
        reason: 'reset-all',
        timerMode: 'stop'
      };
    }
    case WORKER_ACTIONS.RESUME:
      return {
        completionReason: '',
        handled: true,
        nextSession: resumeSession(session, now),
        reason: 'resume',
        timerMode: 'start'
      };
    case WORKER_ACTIONS.START_STEP:
      return {
        completionReason: '',
        handled: true,
        nextSession: prepareSessionForStepStart(session, settings, now),
        reason: 'start',
        timerMode: 'start'
      };
    case WORKER_ACTIONS.SET_FOCUS_TAG:
      return {
        completionReason: '',
        handled: true,
        nextSession: setSessionFocusTag(session, payload.focusTag, now),
        reason: 'set-focus-tag',
        timerMode: 'keep'
      };
    default:
      return {
        completionReason: '',
        handled: false,
        nextSession: session,
        reason: '',
        timerMode: 'keep'
      };
  }
}
