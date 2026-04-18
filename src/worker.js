import { createCompletionKey } from './core/alerts.js';
import { WORKER_TICK_INTERVAL_MS } from './core/constants.js';
import {
  normalizeSession,
  pauseSession,
  prepareSessionForStepStart,
  resetSession,
  resumeSession,
  syncIdleSessionWithSettings,
  syncSession
} from './core/session.js';

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
  emit('STEP_FINISHED', session, {
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

  emit(emitTick ? 'TICK' : 'STATE', session, {
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

  emit('STATE', session, { reason });
}

self.onmessage = ({ data }) => {
  const { payload = {}, type } = data ?? {};

  try {
    if (type === 'INIT') {
      replaceSession(payload.session, 'init');
      return;
    }

    if (!session) {
      emit('ERROR', session, { error: 'Worker is not initialized yet.' });
      return;
    }

    const now = payload.now ?? Date.now();

    switch (type) {
      case 'PAUSE':
        session = pauseSession(session, now);
        stopTimers();
        emit('STATE', session, { reason: 'pause' });
        break;
      case 'RESET_ALL':
        session = resetSession(session, now);
        if (payload.settings) {
          session = syncIdleSessionWithSettings(session, payload.settings, now);
        }
        stopTimers();
        emit('STATE', session, { reason: 'reset-all' });
        break;
      case 'RESUME':
        session = resumeSession(session, now);
        startTicker();
        emit('STATE', session, { reason: 'resume' });
        break;
      case 'START_STEP':
        session = prepareSessionForStepStart(session, payload.settings, now);
        startTicker();
        emit('STATE', session, { reason: 'start' });
        break;
      case 'SYNC_NOW':
        syncAndEmit(now, false);
        break;
      default:
        emit('ERROR', session, { error: `Unknown worker message: ${type}` });
    }
  } catch (error) {
    emit('ERROR', session, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
