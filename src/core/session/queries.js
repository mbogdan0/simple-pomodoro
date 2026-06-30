import { clamp } from '../utils.js';

function asNonNegativeNumber(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

export function isInfiniteSession(session) {
  return session?.cycleMode === 'infinite';
}

export function getCurrentStep(session) {
  return session.scenario[session.currentStepIndex];
}

export function isWorkStep(session) {
  return getCurrentStep(session)?.type === 'work';
}

export function isBreakStep(session) {
  const type = getCurrentStep(session)?.type;
  return type === 'shortBreak' || type === 'longBreak';
}

export function getCurrentStepDurationMs(session) {
  return getCurrentStep(session)?.durationMs ?? 0;
}

export function getRemainingMs(session, now = Date.now()) {
  if (session.status === 'running') {
    return Math.max(0, (session.endsAt ?? now) - now);
  }

  if (session.status === 'paused') {
    return Math.max(0, session.remainingMsAtPause ?? getCurrentStepDurationMs(session));
  }

  if (session.status === 'completed_waiting_next') {
    return 0;
  }

  return getCurrentStepDurationMs(session);
}

export function getElapsedMs(session, now = Date.now()) {
  if (session.status === 'idle') {
    return 0;
  }

  if (session.status === 'running' || session.status === 'completed_waiting_next') {
    if (Number.isFinite(session.stepStartedAt)) {
      return Math.max(0, now - session.stepStartedAt);
    }
  }

  return Math.max(0, getCurrentStepDurationMs(session) - getRemainingMs(session, now));
}

export function getOverrunMs(session, now = Date.now()) {
  if (session?.status !== 'completed_waiting_next') {
    return 0;
  }

  const finishedAt = Number.isFinite(session.finishedAt) ? session.finishedAt : now;
  return Math.max(0, now - finishedAt);
}

export function getProgressRatio(session, now = Date.now()) {
  const duration = getCurrentStepDurationMs(session);

  if (!duration) {
    return 0;
  }

  return clamp(1 - getRemainingMs(session, now) / duration, 0, 1);
}

export function hasNextStep(session) {
  if (isInfiniteSession(session)) {
    return true;
  }

  return session.currentStepIndex < session.scenario.length - 1;
}

export function canResetSession(session) {
  return (
    session.status !== 'idle' ||
    session.currentStepIndex !== 0 ||
    asNonNegativeNumber(session.roundIndex, 1) !== 1
  );
}
