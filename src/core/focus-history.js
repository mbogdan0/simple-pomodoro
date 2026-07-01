import { createCompletionKey } from './alerts.js';
import {
  APP_NAME,
  FOCUS_HISTORY_BACKUP_WARNING_AGE_MS,
  FOCUS_TAGS,
  MAX_FOCUS_HISTORY_ENTRIES,
  STEP_TYPES
} from './constants.js';
import { normalizeFocusNote } from './focus-note.js';
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

  return normalizeFocusHistoryEntries(rawHistory).slice(0, MAX_FOCUS_HISTORY_ENTRIES);
}

function normalizeFocusHistoryEntries(rawHistory = []) {
  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory.map((entry) => normalizeFocusHistoryEntry(entry)).filter(Boolean);
}

function createFocusHistoryNaturalKey(entry) {
  return [entry.completedAt, entry.durationMs, entry.stepId, entry.stepType].join('|');
}

function sortFocusHistoryNewestFirst(history = []) {
  return [...history].sort((first, second) => second.completedAt - first.completedAt);
}

function normalizeExportedAt(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

export function createFocusHistoryExportPayload(history = [], exportedAt = Date.now()) {
  return {
    app: APP_NAME,
    exportedAt: normalizeExportedAt(exportedAt) ?? Date.now(),
    focusHistory: normalizeFocusHistory(sortFocusHistoryNewestFirst(history)),
    version: 1
  };
}

export function parseFocusHistoryImportPayload(payload) {
  const rawHistory = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? payload.focusHistory
      : null;
  const focusHistory = normalizeFocusHistoryEntries(rawHistory);

  if (!Array.isArray(rawHistory) || focusHistory.length === 0) {
    return {
      error: 'No valid focus history entries were found.',
      focusHistory: []
    };
  }

  return {
    error: '',
    focusHistory
  };
}

export function mergeFocusHistory(localHistory = [], importedHistory = []) {
  const normalizedLocalHistory = normalizeFocusHistory(localHistory);
  const normalizedImportedHistory = normalizeFocusHistoryEntries(importedHistory);
  const existingIds = new Set(normalizedLocalHistory.map((entry) => entry.id));
  const existingNaturalKeys = new Set(normalizedLocalHistory.map(createFocusHistoryNaturalKey));
  const addedEntries = [];
  let skippedCount = 0;

  normalizedImportedHistory.forEach((entry) => {
    const naturalKey = createFocusHistoryNaturalKey(entry);

    if (existingIds.has(entry.id) || existingNaturalKeys.has(naturalKey)) {
      skippedCount += 1;
      return;
    }

    existingIds.add(entry.id);
    existingNaturalKeys.add(naturalKey);
    addedEntries.push(entry);
  });

  const nextHistory = sortFocusHistoryNewestFirst([
    ...normalizedLocalHistory,
    ...addedEntries
  ]).slice(0, MAX_FOCUS_HISTORY_ENTRIES);

  return {
    addedCount: addedEntries.length,
    history: nextHistory,
    skippedCount
  };
}

export function createFocusHistoryBackupStatus(
  history = [],
  lastExportedAt = null,
  now = Date.now()
) {
  const normalizedHistory = normalizeFocusHistory(history);
  const normalizedLastExportedAt = normalizeExportedAtForStatus(lastExportedAt);

  if (!normalizedHistory.length) {
    return {
      ageDays: null,
      isWarning: false,
      label: '',
      lastExportedAt: normalizedLastExportedAt
    };
  }

  const completedTimes = normalizedHistory.map((entry) => entry.completedAt);
  const historySpanMs = Math.max(...completedTimes) - Math.min(...completedTimes);
  const ageMs =
    normalizedLastExportedAt === null ? Infinity : Math.max(0, now - normalizedLastExportedAt);
  const ageDays =
    normalizedLastExportedAt === null ? null : Math.floor(ageMs / (24 * 60 * 60 * 1000));

  return {
    ageDays,
    isWarning:
      historySpanMs >= FOCUS_HISTORY_BACKUP_WARNING_AGE_MS &&
      ageMs >= FOCUS_HISTORY_BACKUP_WARNING_AGE_MS,
    label: formatFocusHistoryBackupLabel(ageDays),
    lastExportedAt: normalizedLastExportedAt
  };
}

function normalizeExportedAtForStatus(value) {
  return normalizeExportedAt(value);
}

function formatFocusHistoryBackupLabel(ageDays) {
  if (ageDays === null) {
    return 'Last backup: never';
  }

  if (ageDays === 0) {
    return 'Last backup: today';
  }

  return `Last backup: ${ageDays} days ago`;
}

export function createFocusHistoryEntry({
  completedAt,
  durationMs,
  focusNote = '',
  idHint = '',
  session
}) {
  const step = getCurrentStep(session);

  if (step?.type !== 'work') {
    return null;
  }

  const normalizedCompletedAt = normalizeTimestamp(completedAt);
  const normalizedDurationMs = normalizeDurationMs(durationMs);
  const id = normalizeHistoryId(
    idHint || createCompletionKey({ ...session, finishedAt: completedAt })
  );
  const stepId = normalizeHistoryId(step.id);

  if (
    !id ||
    !stepId ||
    !Number.isFinite(normalizedCompletedAt) ||
    !Number.isFinite(normalizedDurationMs)
  ) {
    return null;
  }

  const normalizedFocusNote = normalizeFocusNote(focusNote);

  const entry = {
    completedAt: normalizedCompletedAt,
    durationMs: normalizedDurationMs,
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
