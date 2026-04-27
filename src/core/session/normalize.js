import { FOCUS_TAGS } from '../constants.js';
import { createDefaultScenario, normalizeScenarioStep } from '../settings.js';
import { clamp } from '../utils.js';

const VALID_SESSION_STATUSES = ['idle', 'running', 'paused', 'completed_waiting_next'];

function normalizeTimestamp(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeFocusTag(value) {
  return FOCUS_TAGS.includes(value) ? value : 'none';
}

function ensureScenarioSnapshot(rawScenario, settings) {
  if (Array.isArray(rawScenario) && rawScenario.length) {
    return rawScenario.map((step, index) =>
      normalizeScenarioStep(step, index, settings?.templateDurations)
    );
  }

  return createDefaultScenario(settings?.templateDurations, settings?.repeatCount);
}

export function normalizeSession(rawSession = {}, settings) {
  const scenario = ensureScenarioSnapshot(rawSession.scenario, settings);
  const status = VALID_SESSION_STATUSES.includes(rawSession.status) ? rawSession.status : 'idle';
  const currentStepIndex = clamp(
    Math.floor(Number(rawSession.currentStepIndex) || 0),
    0,
    scenario.length - 1
  );

  const normalized = {
    alertsDispatched: Boolean(rawSession.alertsDispatched),
    completedInBackground: Boolean(rawSession.completedInBackground),
    currentStepIndex,
    endsAt: normalizeTimestamp(rawSession.endsAt),
    finishedAt: normalizeTimestamp(rawSession.finishedAt),
    focusTag: normalizeFocusTag(rawSession.focusTag),
    remainingMsAtPause: normalizeTimestamp(rawSession.remainingMsAtPause),
    scenario,
    status,
    stepStartedAt: normalizeTimestamp(rawSession.stepStartedAt),
    updatedAt: normalizeTimestamp(rawSession.updatedAt) ?? Date.now()
  };

  if (normalized.status === 'running' && (!normalized.stepStartedAt || !normalized.endsAt)) {
    return normalizeSession(
      {
        ...normalized,
        alertsDispatched: false,
        completedInBackground: false,
        endsAt: null,
        finishedAt: null,
        remainingMsAtPause: null,
        status: 'idle',
        stepStartedAt: null,
        updatedAt: Date.now()
      },
      settings
    );
  }

  if (normalized.status === 'paused' && !normalized.remainingMsAtPause) {
    return normalizeSession(
      {
        ...normalized,
        alertsDispatched: false,
        completedInBackground: false,
        endsAt: null,
        finishedAt: null,
        remainingMsAtPause: null,
        status: 'idle',
        stepStartedAt: null,
        updatedAt: Date.now()
      },
      settings
    );
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

export function syncIdleSessionWithSettings(session, settings, now = Date.now()) {
  if (session.status !== 'idle') {
    return session;
  }

  const scenario = ensureScenarioSnapshot(null, settings);
  const currentStepIndex = clamp(session.currentStepIndex, 0, scenario.length - 1);

  return normalizeSession(
    {
      currentStepIndex,
      focusTag: session.focusTag,
      scenario,
      status: 'idle',
      updatedAt: now
    },
    settings
  );
}

export function normalizeSessionFocusTag(focusTag) {
  return normalizeFocusTag(focusTag);
}
