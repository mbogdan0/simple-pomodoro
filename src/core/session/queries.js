import { clamp } from '../utils.js';

function asNonNegativeNumber(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

export function isFreeTimerMode(session) {
  return session?.sessionMode === 'free';
}

function getFreeTimerElapsedMs(session, now = Date.now()) {
  const accumulatedMs = asNonNegativeNumber(session?.freeAccumulatedMs, 0);

  if (session?.status !== 'running') {
    return accumulatedMs;
  }

  const segmentStartedAt = session?.freeSegmentStartedAt;

  if (!Number.isFinite(segmentStartedAt)) {
    return accumulatedMs;
  }

  return accumulatedMs + Math.max(0, now - segmentStartedAt);
}

export function getCurrentStep(session) {
  return session.scenario[session.currentStepIndex];
}

export function getCurrentStepDurationMs(session) {
  return getCurrentStep(session)?.durationMs ?? 0;
}

export function getRemainingMs(session, now = Date.now()) {
  if (isFreeTimerMode(session)) {
    return getFreeTimerElapsedMs(session, now);
  }

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
  if (isFreeTimerMode(session)) {
    return getFreeTimerElapsedMs(session, now);
  }

  return Math.max(0, getCurrentStepDurationMs(session) - getRemainingMs(session, now));
}

export function getProgressRatio(session, now = Date.now()) {
  if (isFreeTimerMode(session)) {
    return 0;
  }

  const duration = getCurrentStepDurationMs(session);

  if (!duration) {
    return 0;
  }

  return clamp(1 - getRemainingMs(session, now) / duration, 0, 1);
}

export function hasNextStep(session) {
  return session.currentStepIndex < session.scenario.length - 1;
}

export function canResetSession(session) {
  return session.status !== 'idle' || session.currentStepIndex !== 0;
}

export function canStartFreeTimer(session) {
  return (
    session?.sessionMode === 'cycle' &&
    session?.status === 'idle' &&
    session?.currentStepIndex === 0
  );
}
