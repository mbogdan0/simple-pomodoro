import {
  startFreeTimer,
  resetFreeTimer,
  forceCompleteCurrentStep,
  pauseSession,
  prepareSessionForStepStart,
  resetSession,
  resumeSession,
  setSessionFocusTag
} from './transitions.js';
import { syncIdleSessionWithSettings } from './normalize.js';
import { WORKER_ACTIONS } from '../worker-protocol.js';
import { createFreeTimerHistoryEntry } from '../focus-history.js';

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
    case WORKER_ACTIONS.END_STEP_EARLY:
      return {
        completionReason: 'manual_early',
        handled: true,
        historyEntry: null,
        nextSession: forceCompleteCurrentStep(session, now),
        reason: 'end-step-early',
        timerMode: 'stop'
      };
    case WORKER_ACTIONS.DISCARD_FREE_TIMER:
      if (session?.sessionMode !== 'free') {
        return {
          completionReason: '',
          handled: true,
          historyEntry: null,
          nextSession: session,
          reason: 'discard-free-timer-ignored',
          timerMode: 'keep'
        };
      }

      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession: resetFreeTimer(session, settings, now),
        reason: 'discard-free-timer',
        timerMode: 'stop'
      };
    case WORKER_ACTIONS.FINISH_FREE_TIMER: {
      if (session?.sessionMode !== 'free') {
        return {
          completionReason: '',
          handled: true,
          historyEntry: null,
          nextSession: session,
          reason: 'finish-free-timer-ignored',
          timerMode: 'keep'
        };
      }

      const historyEntry = createFreeTimerHistoryEntry({
        finishedAt: now,
        focusNote: payload.focusNote,
        session
      });

      return {
        completionReason: '',
        handled: true,
        historyEntry,
        nextSession: resetFreeTimer(session, settings, now),
        reason: 'finish-free-timer',
        timerMode: 'stop'
      };
    }
    case WORKER_ACTIONS.PAUSE:
      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession: pauseSession(session, now),
        reason: 'pause',
        timerMode: 'stop'
      };
    case WORKER_ACTIONS.RESET_ALL: {
      const reset = resetSession(session, now);
      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession: settings ? syncIdleSessionWithSettings(reset, settings, now) : reset,
        reason: 'reset-all',
        timerMode: 'stop'
      };
    }
    case WORKER_ACTIONS.RESUME:
      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession: resumeSession(session, now),
        reason: 'resume',
        timerMode: 'start'
      };
    case WORKER_ACTIONS.START_FREE_TIMER: {
      const nextSession = startFreeTimer(session, settings, now);

      if (nextSession === session) {
        return {
          completionReason: '',
          handled: true,
          historyEntry: null,
          nextSession: session,
          reason: 'start-free-timer-ignored',
          timerMode: 'keep'
        };
      }

      return {
        completionReason: '',
        handled: true,
        historyEntry: null,
        nextSession,
        reason: 'start-free-timer',
        timerMode: 'start'
      };
    }
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
