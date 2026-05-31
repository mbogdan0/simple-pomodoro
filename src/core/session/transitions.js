import { clamp } from '../utils.js';
import { normalizeSessionFocusTag, syncIdleSessionWithSettings } from './normalize.js';
import {
  canStartFreeTimer,
  getCurrentStepDurationMs,
  getElapsedMs,
  getRemainingMs,
  hasNextStep,
  isFreeTimerMode
} from './queries.js';
import { syncSession } from './sync.js';

function clearFreeTimerFields(session) {
  return {
    ...session,
    freeAccumulatedMs: 0,
    freeSegmentStartedAt: null,
    freeTimerStartedAt: null,
    sessionMode: 'cycle'
  };
}

function clearCycleTimerFields(session) {
  return {
    ...session,
    completedInBackground: false,
    endsAt: null,
    finishedAt: null,
    remainingMsAtPause: null,
    stepStartedAt: null
  };
}

export function startFreeTimer(session, settings, now = Date.now()) {
  if (!canStartFreeTimer(session)) {
    return session;
  }

  const syncedCycle = syncIdleSessionWithSettings(session, settings, now);

  return {
    ...clearCycleTimerFields(syncedCycle),
    freeAccumulatedMs: 0,
    freeSegmentStartedAt: now,
    freeTimerStartedAt: now,
    sessionMode: 'free',
    status: 'running',
    updatedAt: now
  };
}

export function resetFreeTimer(session, settings, now = Date.now()) {
  if (!isFreeTimerMode(session)) {
    return session;
  }

  const cycleReset = clearFreeTimerFields(resetSession(session, now));
  return settings ? syncIdleSessionWithSettings(cycleReset, settings, now) : cycleReset;
}

export function startCurrentStep(session, now = Date.now()) {
  const durationMs = getCurrentStepDurationMs(session);

  return {
    ...clearFreeTimerFields(session),
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
  if (isFreeTimerMode(session)) {
    return session;
  }

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
  if (isFreeTimerMode(session)) {
    return session;
  }

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

  if (isFreeTimerMode(session)) {
    return {
      ...session,
      freeAccumulatedMs: getElapsedMs(session, now),
      freeSegmentStartedAt: null,
      status: 'paused',
      updatedAt: now
    };
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

  if (isFreeTimerMode(session)) {
    if (!Number.isFinite(session.freeTimerStartedAt)) {
      return resetFreeTimer(session, null, now);
    }

    return {
      ...session,
      freeSegmentStartedAt: now,
      status: 'running',
      updatedAt: now
    };
  }

  return {
    ...session,
    endsAt: now + (session.remainingMsAtPause ?? getCurrentStepDurationMs(session)),
    remainingMsAtPause: null,
    status: 'running',
    updatedAt: now
  };
}

export function forceCompleteCurrentStep(session, now = Date.now()) {
  if (!session || (session.status !== 'running' && session.status !== 'paused')) {
    return session;
  }

  if (isFreeTimerMode(session)) {
    return session;
  }

  const remainingMs = getRemainingMs(session, now);

  if (session.status === 'running' && remainingMs <= 0) {
    return syncSession(session, now);
  }

  return {
    ...session,
    alertsDispatched: false,
    completedInBackground: false,
    endsAt: session.endsAt,
    finishedAt: now,
    remainingMsAtPause: remainingMs,
    status: 'completed_waiting_next',
    updatedAt: now
  };
}

function resetCurrentStep(session, now = Date.now()) {
  const cycleSession = clearFreeTimerFields(session);

  return {
    ...cycleSession,
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

function goToStep(session, nextStepIndex, now = Date.now()) {
  return resetCurrentStep(
    {
      ...clearFreeTimerFields(session),
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
