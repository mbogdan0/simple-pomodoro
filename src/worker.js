import { createCompletionKey } from './core/alerts.js';
import { WORKER_TICK_INTERVAL_MS } from './core/constants.js';
import {
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

let session = null;
let completionWatchdogHandle = null;
let lastCompletionKey = '';
let tickHandle = null;

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

function emitCompletionIfNeeded() {
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
    reason: 'completed'
  });
  return true;
}

function syncAndEmit(now = Date.now(), emitTick = false) {
  if (!session) {
    return;
  }

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

    if (!session) {
      emit(WORKER_MESSAGE_TYPES.ERROR, session, { error: 'Worker is not initialized yet.' });
      return;
    }

    const now = payload.now ?? Date.now();

    switch (type) {
      case WORKER_ACTIONS.PAUSE:
        session = pauseSession(session, now);
        stopTimers();
        emit(WORKER_MESSAGE_TYPES.STATE, session, { reason: 'pause' });
        break;
      case WORKER_ACTIONS.RESET_ALL:
        session = resetSession(session, now);
        if (payload.settings) {
          session = syncIdleSessionWithSettings(session, payload.settings, now);
        }
        stopTimers();
        emit(WORKER_MESSAGE_TYPES.STATE, session, { reason: 'reset-all' });
        break;
      case WORKER_ACTIONS.RESUME:
        session = resumeSession(session, now);
        startTicker();
        emit(WORKER_MESSAGE_TYPES.STATE, session, { reason: 'resume' });
        break;
      case WORKER_ACTIONS.START_STEP:
        session = prepareSessionForStepStart(session, payload.settings, now);
        startTicker();
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
