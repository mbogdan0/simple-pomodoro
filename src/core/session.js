import { BACKGROUND_COMPLETION_THRESHOLD_MS } from './constants.js';
import { createDefaultScenario, normalizeScenarioStep } from './settings.js';
import { clamp } from './utils.js';

const VALID_SESSION_STATUSES = ['idle', 'running', 'paused', 'completed_waiting_next'];

function normalizeTimestamp(value) {
  return Number.isFinite(value) ? value : null;
}

function ensureScenarioSnapshot(rawScenario, settings) {
  if (Array.isArray(rawScenario) && rawScenario.length) {
    return rawScenario.map((step, index) => normalizeScenarioStep(step, index, settings?.templateDurations));
  }

  return createDefaultScenario(settings?.templateDurations, settings?.repeatCount);
}

export function normalizeSession(rawSession = {}, settings) {
  const scenario = ensureScenarioSnapshot(rawSession.scenario, settings);
  const status = VALID_SESSION_STATUSES.includes(rawSession.status) ? rawSession.status : 'idle';
  const currentStepIndex = clamp(Math.floor(Number(rawSession.currentStepIndex) || 0), 0, scenario.length - 1);

  const normalized = {
    alertsDispatched: Boolean(rawSession.alertsDispatched),
    completedInBackground: Boolean(rawSession.completedInBackground),
    currentStepIndex,
    endsAt: normalizeTimestamp(rawSession.endsAt),
    finishedAt: normalizeTimestamp(rawSession.finishedAt),
    remainingMsAtPause: normalizeTimestamp(rawSession.remainingMsAtPause),
    scenario,
    status,
    stepStartedAt: normalizeTimestamp(rawSession.stepStartedAt),
    updatedAt: normalizeTimestamp(rawSession.updatedAt) ?? Date.now()
  };

  if (normalized.status === 'running' && (!normalized.stepStartedAt || !normalized.endsAt)) {
    return resetCurrentStep(normalized, Date.now());
  }

  if (normalized.status === 'paused' && !normalized.remainingMsAtPause) {
    return resetCurrentStep(normalized, Date.now());
  }

  if (normalized.status === 'completed_waiting_next') {
    normalized.finishedAt = normalized.finishedAt ?? normalized.endsAt ?? Date.now();
  }

  return normalized;
}

export function createInitialSession(settings) {
  return normalizeSession(
    {
      currentStepIndex: 0,
      status: 'idle'
    },
    settings
  );
}

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
  let nextSession = session;

  if (nextSession.status === 'completed_waiting_next') {
    nextSession = goToNextStep(nextSession, now);
  }

  nextSession = syncIdleSessionWithSettings(nextSession, settings, now);
  return startCurrentStep(nextSession, now);
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

export function hasNextStep(session) {
  return session.currentStepIndex < session.scenario.length - 1;
}

export function goToNextStep(session, now = Date.now()) {
  if (!hasNextStep(session)) {
    return resetSession(session, now);
  }

  return goToStep(session, session.currentStepIndex + 1, now);
}

export function syncSession(session, now = Date.now()) {
  if (session.status !== 'running') {
    return {
      ...session,
      updatedAt: now
    };
  }

  if (now < (session.endsAt ?? 0)) {
    return {
      ...session,
      updatedAt: now
    };
  }

  return {
    ...session,
    completedInBackground: now - (session.endsAt ?? now) > BACKGROUND_COMPLETION_THRESHOLD_MS,
    endsAt: session.endsAt,
    finishedAt: session.endsAt ?? now,
    remainingMsAtPause: 0,
    status: 'completed_waiting_next',
    updatedAt: now
  };
}

export function markAlertsDispatched(session) {
  return {
    ...session,
    alertsDispatched: true
  };
}

export function syncIdleSessionWithSettings(session, settings, now = Date.now()) {
  if (session.status !== 'idle') {
    return session;
  }

  const scenario = ensureScenarioSnapshot(null, settings);
  const currentStepIndex = clamp(session.currentStepIndex, 0, scenario.length - 1);

  return normalizeSession(
    {
      currentStepIndex,
      scenario,
      status: 'idle',
      updatedAt: now
    },
    settings
  );
}
