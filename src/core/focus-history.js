import { createCompletionKey } from './alerts.js';
import { FOCUS_TAGS, MAX_FOCUS_HISTORY_ENTRIES, STEP_TYPES } from './constants.js';
import { normalizeFocusNote } from './focus-note.js';
import { getCurrentStep } from './session.js';
import { getElapsedMs, isFreeTimerMode } from './session/queries.js';

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
  const focusNote = normalizeFocusNote(rawEntry.focusNote);
  const stepId = normalizeHistoryId(rawEntry.stepId);

  if (!id || !stepId || !Number.isFinite(completedAt) || !Number.isFinite(durationMs)) {
    return null;
  }

  const normalizedEntry = {
    completedAt,
    durationMs,
    focusTag,
    id,
    stepId,
    stepType: normalizeStepType(rawEntry.stepType)
  };

  if (focusNote) {
    normalizedEntry.focusNote = focusNote;
  }

  return normalizedEntry;
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

export function createFocusHistoryEntry(session, completionKeyHint = '', focusNote = '') {
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

  const normalizedFocusNote = normalizeFocusNote(focusNote);

  const entry = {
    completedAt,
    durationMs,
    focusTag: normalizeFocusTag(session.focusTag),
    id,
    stepId,
    stepType: 'work'
  };

  if (normalizedFocusNote) {
    entry.focusNote = normalizedFocusNote;
  }

  return entry;
}

export function createFreeTimerHistoryEntry({ session, finishedAt, focusNote = '' }) {
  if (!isFreeTimerMode(session)) {
    return null;
  }

  if (session?.status !== 'running' && session?.status !== 'paused') {
    return null;
  }

  const startedAt = normalizeTimestamp(session?.freeTimerStartedAt);
  const completedAt = normalizeTimestamp(finishedAt);

  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) {
    return null;
  }

  const safeCompletedAt = Math.max(completedAt, startedAt);
  const durationMs = normalizeDurationMs(getElapsedMs(session, safeCompletedAt));
  const stepId = normalizeHistoryId(`free-${startedAt}`);
  const id = normalizeHistoryId(`${stepId}:${safeCompletedAt}`);

  if (!id || !stepId || !Number.isFinite(durationMs)) {
    return null;
  }

  const normalizedFocusNote = normalizeFocusNote(focusNote);

  const entry = {
    completedAt: safeCompletedAt,
    durationMs,
    focusTag: normalizeFocusTag(session.focusTag),
    id,
    stepId,
    stepType: 'work'
  };

  if (normalizedFocusNote) {
    entry.focusNote = normalizedFocusNote;
  }

  return entry;
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

export function updateFocusHistoryEntryFocusTag(history = [], entryId, focusTag) {
  const normalizedHistory = normalizeFocusHistory(history);
  const normalizedId = normalizeHistoryId(entryId);
  const hasSupportedTag = typeof focusTag === 'string' && FOCUS_TAGS.includes(focusTag);

  if (!normalizedId || !hasSupportedTag) {
    return normalizedHistory;
  }

  let matched = false;
  const nextHistory = normalizedHistory.map((entry) => {
    if (entry.id !== normalizedId) {
      return entry;
    }

    matched = true;

    if (entry.focusTag === focusTag) {
      return entry;
    }

    return {
      ...entry,
      focusTag
    };
  });

  return matched ? nextHistory : normalizedHistory;
}

export function updateFocusHistoryEntryFocusNote(history = [], entryId, focusNote) {
  const normalizedHistory = normalizeFocusHistory(history);
  const normalizedId = normalizeHistoryId(entryId);

  if (!normalizedId) {
    return normalizedHistory;
  }

  const normalizedFocusNote = normalizeFocusNote(focusNote);
  let matched = false;
  let changed = false;

  const nextHistory = normalizedHistory.map((entry) => {
    if (entry.id !== normalizedId) {
      return entry;
    }

    matched = true;
    const currentFocusNote = normalizeFocusNote(entry.focusNote);

    if (currentFocusNote === normalizedFocusNote) {
      return entry;
    }

    changed = true;

    if (!normalizedFocusNote) {
      return (
        normalizeFocusHistoryEntry({
          ...entry,
          focusNote: ''
        }) ?? entry
      );
    }

    return {
      ...entry,
      focusNote: normalizedFocusNote
    };
  });

  if (!matched || !changed) {
    return normalizedHistory;
  }

  return nextHistory;
}
