import { clamp } from '../utils.js';
import { normalizeSessionFocusTag, syncIdleSessionWithSettings } from './normalize.js';
import { getCurrentStepDurationMs, getRemainingMs, hasNextStep } from './queries.js';
import { syncSession } from './sync.js';

export function startCurrentStep(session, now = Date.now()) {
  const durationMs = getCurrentStepDurationMs(session);

  return {
    ...session,
    alertsDispatched: false,
    completedInBackground: false,
    endsAt: now + durationMs,
    finishedAt: null,
    remainingMsAtPause: null,
    status: 'running',
    stepStartedAt: now,
    updatedAt: now
  };
}

export function prepareSessionForStepStart(session, settings, now = Date.now()) {
  if (session.status === 'running') {
    return session;
  }

  let nextSession = session;

  if (nextSession.status === 'completed_waiting_next') {
    nextSession = goToNextStep(nextSession, now);
  }

  if (nextSession.status === 'idle' && nextSession.currentStepIndex === 0) {
    nextSession = syncIdleSessionWithSettings(nextSession, settings, now);
  }

  return startCurrentStep(nextSession, now);
}

export function advanceAfterCompletion(session, settings, now = Date.now()) {
  if (session.status !== 'completed_waiting_next') {
    return session;
  }

  const hasUpcomingStep = hasNextStep(session);
  let nextSession = goToNextStep(session, now);

  if (settings?.autoStartNextStep && hasUpcomingStep) {
    nextSession = startCurrentStep(nextSession, now);
  }

  return nextSession;
}

export function pauseSession(session, now = Date.now()) {
  if (session.status !== 'running') {
    return session;
  }

  const remainingMs = getRemainingMs(session, now);

  if (remainingMs <= 0) {
    return syncSession(session, now);
  }

  return {
    ...session,
    endsAt: null,
    remainingMsAtPause: remainingMs,
    status: 'paused',
    updatedAt: now
  };
}

export function resumeSession(session, now = Date.now()) {
  if (session.status !== 'paused') {
    return session;
  }

  return {
    ...session,
    endsAt: now + (session.remainingMsAtPause ?? getCurrentStepDurationMs(session)),
    remainingMsAtPause: null,
    status: 'running',
    updatedAt: now
  };
}

export function resetCurrentStep(session, now = Date.now()) {
  return {
    ...session,
    alertsDispatched: false,
    completedInBackground: false,
    endsAt: null,
    finishedAt: null,
    remainingMsAtPause: null,
    status: 'idle',
    stepStartedAt: null,
    updatedAt: now
  };
}

export function resetSession(session, now = Date.now()) {
  return resetCurrentStep(
    {
      ...session,
      currentStepIndex: 0
    },
    now
  );
}

export function goToStep(session, nextStepIndex, now = Date.now()) {
  return resetCurrentStep(
    {
      ...session,
      currentStepIndex: clamp(nextStepIndex, 0, session.scenario.length - 1)
    },
    now
  );
}

export function goToNextStep(session, now = Date.now()) {
  if (!hasNextStep(session)) {
    return resetSession(session, now);
  }

  return goToStep(session, session.currentStepIndex + 1, now);
}

export function setSessionFocusTag(session, focusTag, now = Date.now()) {
  const normalizedFocusTag = normalizeSessionFocusTag(focusTag);

  if (session.focusTag === normalizedFocusTag) {
    return session;
  }

  return {
    ...session,
    focusTag: normalizedFocusTag,
    updatedAt: now
  };
}

export function markAlertsDispatched(session) {
  return {
    ...session,
    alertsDispatched: true
  };
}
