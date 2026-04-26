import { createCompletionKey } from './core/alerts.js';
import { WORKER_TICK_INTERVAL_MS } from './core/constants.js';
import {
  forceCompleteCurrentStep,
  normalizeSession,
  pauseSession,
  prepareSessionForStepStart,
  resetSession,
  resumeSession,
  setSessionFocusTag,
  syncIdleSessionWithSettings,
  syncSession
} from './core/session.js';
import { WORKER_ACTIONS, WORKER_MESSAGE_TYPES } from './core/worker-protocol.js';

const IDLE_REMINDER_INTERVAL_MS = 60_000;

let session = null;
let completionWatchdogHandle = null;
let lastCompletionKey = '';
let tickHandle = null;
let idleReminderEnabled = false;
let idleReminderHandle = null;

function emit(type, nextSession, extra = {}) {
  self.postMessage({
    ...extra,
    session: nextSession,
    type
  });
}

function stopCompletionWatchdog() {
  if (completionWatchdogHandle) {
    clearTimeout(completionWatchdogHandle);
    completionWatchdogHandle = null;
  }
}

function stopTicker() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function stopIdleReminder() {
  if (idleReminderHandle) {
    clearTimeout(idleReminderHandle);
    idleReminderHandle = null;
  }
}

function scheduleIdleReminder() {
  stopIdleReminder();

  if (!idleReminderEnabled) return;
  if (!session || session.status !== 'idle') return;

  idleReminderHandle = setTimeout(() => {
    self.postMessage({
      now: Date.now(),
      type: WORKER_MESSAGE_TYPES.IDLE_REMINDER
    });
    scheduleIdleReminder();
  }, IDLE_REMINDER_INTERVAL_MS);
}

function stopTimers() {
  stopTicker();
  stopCompletionWatchdog();
}

function scheduleCompletionWatchdog() {
  stopCompletionWatchdog();

  if (!session || session.status !== 'running' || !session.endsAt) {
    return;
  }

  const delay = Math.max(0, session.endsAt - Date.now()) + 50;
  completionWatchdogHandle = setTimeout(() => {
    syncAndEmit(Date.now(), false);
  }, delay);
}

function emitCompletionIfNeeded(completionReason = 'completed') {
  if (!session || session.status !== 'completed_waiting_next') {
    return false;
  }

  const completionKey = createCompletionKey(session);

  if (!completionKey || completionKey === lastCompletionKey) {
    return false;
  }

  lastCompletionKey = completionKey;
  emit(WORKER_MESSAGE_TYPES.STEP_FINISHED, session, {
    completionKey,
    reason: completionReason
  });
  return true;
}

function syncAndEmit(now = Date.now(), emitTick = false) {
  if (!session) {
    return;
  }

  const previousStatus = session.status;
  session = syncSession(session, now);

  if (session.status === 'running') {
    scheduleCompletionWatchdog();
  }

  if (emitCompletionIfNeeded()) {
    stopTimers();
    return;
  }

  if (session.status !== 'running') {
    stopTimers();
  }

  if (session.status !== previousStatus) {
    scheduleIdleReminder();
  }

  emit(emitTick ? WORKER_MESSAGE_TYPES.TICK : WORKER_MESSAGE_TYPES.STATE, session, {
    reason: emitTick ? 'tick' : 'sync'
  });
}

function startTicker() {
  stopTicker();

  if (!session || session.status !== 'running') {
    stopCompletionWatchdog();
    return;
  }

  tickHandle = setInterval(() => {
    syncAndEmit(Date.now(), true);
  }, WORKER_TICK_INTERVAL_MS);

  scheduleCompletionWatchdog();
}

function replaceSession(nextSession, reason = 'init') {
  session = normalizeSession(nextSession);

  if (session.status === 'running') {
    session = syncSession(session, Date.now());
  }

  if (session.status === 'running') {
    startTicker();
  } else {
    stopTimers();
  }

  scheduleIdleReminder();

  if (emitCompletionIfNeeded()) {
    return;
  }

  emit(WORKER_MESSAGE_TYPES.STATE, session, { reason });
}

self.onmessage = ({ data }) => {
  const { payload = {}, type } = data ?? {};

  try {
    if (type === WORKER_ACTIONS.INIT) {
      replaceSession(payload.session, 'init');
      return;
    }

    if (type === WORKER_ACTIONS.SET_IDLE_REMINDER) {
      idleReminderEnabled = Boolean(payload.enabled);
      scheduleIdleReminder();
      return;
    }

    if (!session) {
      emit(WORKER_MESSAGE_TYPES.ERROR, session, { error: 'Worker is not initialized yet.' });
      return;
    }

    const now = payload.now ?? Date.now();

    switch (type) {
      case WORKER_ACTIONS.END_STEP_EARLY:
        session = forceCompleteCurrentStep(session, now);
        stopTimers();
        scheduleIdleReminder();
        if (emitCompletionIfNeeded('manual_early')) {
          break;
        }
        emit(WORKER_MESSAGE_TYPES.STATE, session, { reason: 'end-step-early' });
        break;
      case WORKER_ACTIONS.PAUSE:
        session = pauseSession(session, now);
        stopTimers();
        scheduleIdleReminder();
        emit(WORKER_MESSAGE_TYPES.STATE, session, { reason: 'pause' });
        break;
      case WORKER_ACTIONS.RESET_ALL:
        session = resetSession(session, now);
        if (payload.settings) {
          session = syncIdleSessionWithSettings(session, payload.settings, now);
        }
        stopTimers();
        scheduleIdleReminder();
        emit(WORKER_MESSAGE_TYPES.STATE, session, { reason: 'reset-all' });
        break;
      case WORKER_ACTIONS.RESUME:
        session = resumeSession(session, now);
        startTicker();
        scheduleIdleReminder();
        emit(WORKER_MESSAGE_TYPES.STATE, session, { reason: 'resume' });
        break;
      case WORKER_ACTIONS.START_STEP:
        session = prepareSessionForStepStart(session, payload.settings, now);
        startTicker();
        scheduleIdleReminder();
        emit(WORKER_MESSAGE_TYPES.STATE, session, { reason: 'start' });
        break;
      case WORKER_ACTIONS.SET_FOCUS_TAG:
        session = setSessionFocusTag(session, payload.focusTag, now);
        emit(WORKER_MESSAGE_TYPES.STATE, session, { reason: 'set-focus-tag' });
        break;
      case WORKER_ACTIONS.SYNC_NOW:
        syncAndEmit(now, false);
        break;
      default:
        emit(WORKER_MESSAGE_TYPES.ERROR, session, { error: `Unknown worker message: ${type}` });
    }
  } catch (error) {
    emit(WORKER_MESSAGE_TYPES.ERROR, session, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
