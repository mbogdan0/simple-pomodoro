import { FOCUS_TAGS } from '../constants.js';
import { createDefaultScenario, normalizeScenarioStep } from '../settings.js';
import { clamp } from '../utils.js';

const VALID_SESSION_STATUSES = ['idle', 'running', 'paused', 'completed_waiting_next'];
const VALID_SESSION_MODES = ['cycle', 'free'];

function normalizeTimestamp(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeFocusTag(value) {
  return FOCUS_TAGS.includes(value) ? value : 'none';
}

function normalizeSessionMode(value) {
  return VALID_SESSION_MODES.includes(value) ? value : 'cycle';
}

function normalizeFreeAccumulatedMs(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
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
    freeAccumulatedMs: normalizeFreeAccumulatedMs(rawSession.freeAccumulatedMs),
    freeSegmentStartedAt: normalizeTimestamp(rawSession.freeSegmentStartedAt),
    freeTimerStartedAt: normalizeTimestamp(rawSession.freeTimerStartedAt),
    focusTag: normalizeFocusTag(rawSession.focusTag),
    remainingMsAtPause: normalizeTimestamp(rawSession.remainingMsAtPause),
    scenario,
    sessionMode: normalizeSessionMode(rawSession.sessionMode),
    status,
    stepStartedAt: normalizeTimestamp(rawSession.stepStartedAt),
    updatedAt: normalizeTimestamp(rawSession.updatedAt) ?? Date.now()
  };

  if (normalized.sessionMode === 'cycle') {
    normalized.freeAccumulatedMs = 0;
    normalized.freeSegmentStartedAt = null;
    normalized.freeTimerStartedAt = null;
  } else {
    normalized.endsAt = null;
    normalized.finishedAt = null;
    normalized.remainingMsAtPause = null;
    normalized.stepStartedAt = null;
    normalized.completedInBackground = false;

    if (
      normalized.status === 'completed_waiting_next' ||
      (normalized.status === 'running' &&
        (!Number.isFinite(normalized.freeTimerStartedAt) ||
          !Number.isFinite(normalized.freeSegmentStartedAt)))
    ) {
      normalized.status = 'idle';
    }

    if (normalized.status === 'paused' && !Number.isFinite(normalized.freeTimerStartedAt)) {
      normalized.status = 'idle';
    }

    if (normalized.status === 'idle') {
      normalized.freeAccumulatedMs = 0;
      normalized.freeSegmentStartedAt = null;
      normalized.freeTimerStartedAt = null;
    }
  }

  if (
    normalized.sessionMode === 'cycle' &&
    normalized.status === 'running' &&
    (!normalized.stepStartedAt || !normalized.endsAt)
  ) {
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

  if (
    normalized.sessionMode === 'cycle' &&
    normalized.status === 'paused' &&
    !normalized.remainingMsAtPause
  ) {
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

  if (normalized.sessionMode === 'cycle' && normalized.status === 'completed_waiting_next') {
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
