import { createCompletionKey } from './alerts.js';
import { FOCUS_TAGS, MAX_FOCUS_HISTORY_ENTRIES, STEP_TYPES } from './constants.js';
import { getCurrentStep } from './session.js';

function normalizeHistoryId(value) {
  return typeof value === 'string' && value ? value : '';
}

function normalizeTimestamp(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeDurationMs(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value));
}

function normalizeStepType(value) {
  return STEP_TYPES.includes(value) ? value : 'work';
}

function normalizeFocusTag(value) {
  return FOCUS_TAGS.includes(value) ? value : 'none';
}

function resolveCompletedFocusDurationMs(session, step) {
  const stepDurationMs = normalizeDurationMs(step?.durationMs);

  if (!Number.isFinite(stepDurationMs)) {
    return null;
  }

  const remainingMs = normalizeDurationMs(session?.remainingMsAtPause);

  if (!Number.isFinite(remainingMs)) {
    return stepDurationMs;
  }

  return normalizeDurationMs(stepDurationMs - remainingMs);
}

export function normalizeFocusHistoryEntry(rawEntry) {
  if (!rawEntry || typeof rawEntry !== 'object') {
    return null;
  }

  const id = normalizeHistoryId(rawEntry.id);
  const completedAt = normalizeTimestamp(rawEntry.completedAt);
  const durationMs = normalizeDurationMs(rawEntry.durationMs);
  const focusTag = normalizeFocusTag(rawEntry.focusTag);
  const stepId = normalizeHistoryId(rawEntry.stepId);

  if (!id || !stepId || !Number.isFinite(completedAt) || !Number.isFinite(durationMs)) {
    return null;
  }

  return {
    completedAt,
    durationMs,
    focusTag,
    id,
    stepId,
    stepType: normalizeStepType(rawEntry.stepType)
  };
}

export function normalizeFocusHistory(rawHistory = []) {
  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory
    .map((entry) => normalizeFocusHistoryEntry(entry))
    .filter(Boolean)
    .slice(0, MAX_FOCUS_HISTORY_ENTRIES);
}

export function createFocusHistoryEntry(session, completionKeyHint = '') {
  if (session?.status !== 'completed_waiting_next') {
    return null;
  }

  const step = getCurrentStep(session);

  if (step?.type !== 'work') {
    return null;
  }

  const id = normalizeHistoryId(completionKeyHint || createCompletionKey(session));
  const completedAt = normalizeTimestamp(session.finishedAt);
  const durationMs = resolveCompletedFocusDurationMs(session, step);
  const stepId = normalizeHistoryId(step.id);

  if (!id || !stepId || !Number.isFinite(completedAt) || !Number.isFinite(durationMs)) {
    return null;
  }

  return {
    completedAt,
    durationMs,
    focusTag: normalizeFocusTag(session.focusTag),
    id,
    stepId,
    stepType: 'work'
  };
}

export function appendFocusHistoryEntry(history = [], rawEntry) {
  const normalizedHistory = normalizeFocusHistory(history);
  const nextEntry = normalizeFocusHistoryEntry(rawEntry);

  if (!nextEntry) {
    return normalizedHistory;
  }

  if (normalizedHistory.some((entry) => entry.id === nextEntry.id)) {
    return normalizedHistory;
  }

  return [nextEntry, ...normalizedHistory].slice(0, MAX_FOCUS_HISTORY_ENTRIES);
}

export function removeFocusHistoryEntry(history = [], entryId) {
  const normalizedId = normalizeHistoryId(entryId);

  if (!normalizedId) {
    return normalizeFocusHistory(history);
  }

  return normalizeFocusHistory(history).filter((entry) => entry.id !== normalizedId);
}
