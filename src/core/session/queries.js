import { clamp } from '../utils.js';

export function getCurrentStep(session) {
  return session.scenario[session.currentStepIndex];
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

export function getProgressRatio(session, now = Date.now()) {
  const duration = getCurrentStepDurationMs(session);

  if (!duration) {
    return 0;
  }

  return clamp(1 - getRemainingMs(session, now) / duration, 0, 1);
}

export function hasNextStep(session) {
  return session.currentStepIndex < session.scenario.length - 1;
}
