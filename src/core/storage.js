import { STORAGE_KEYS } from './constants.js';
import { normalizeFocusNote } from './focus-note.js';
import { normalizeFocusHistory } from './focus-history.js';
import { createDefaultSettings, normalizeSettings } from './settings.js';
import { createInitialSession, normalizeSession } from './session.js';

const memoryFallbackStorage = createMemoryStorage();

function getBrowserStorage() {
  if (!globalThis.localStorage) {
    throw new Error('localStorage is not available in this environment.');
  }

  return globalThis.localStorage;
}

function resolveStorage(storage) {
  if (storage) {
    return storage;
  }

  try {
    return getBrowserStorage();
  } catch {
    return memoryFallbackStorage;
  }
}

function safeGetItem(storage, key) {
  try {
    return {
      ok: true,
      rawValue: storage.getItem(key)
    };
  } catch {
    return {
      ok: false,
      rawValue: null
    };
  }
}

function parseJsonRaw(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function parseJson(storage, key) {
  const primaryRead = safeGetItem(storage, key);

  if (primaryRead.ok) {
    const parsedPrimary = parseJsonRaw(primaryRead.rawValue);

    if (parsedPrimary !== null || storage === memoryFallbackStorage) {
      return parsedPrimary;
    }
  }

  const fallbackRead = safeGetItem(memoryFallbackStorage, key);
  if (!fallbackRead.ok) {
    return null;
  }

  return parseJsonRaw(fallbackRead.rawValue);
}

function writeJson(storage, key, value) {
  const serialized = JSON.stringify(value);

  try {
    storage.setItem(key, serialized);
    return;
  } catch {
    // Ignore and continue to in-memory fallback.
  }

  try {
    memoryFallbackStorage.setItem(key, serialized);
  } catch {
    // Ignore fallback write errors.
  }
}

function normalizeStoredTimestamp(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

export function loadSettings(storage) {
  const resolvedStorage = resolveStorage(storage);
  return normalizeSettings(
    parseJson(resolvedStorage, STORAGE_KEYS.settings) ?? createDefaultSettings()
  );
}

export function saveSettings(settings, storage) {
  writeJson(resolveStorage(storage), STORAGE_KEYS.settings, settings);
}

export function loadActiveSession(settings, storage) {
  const rawSession = parseJson(resolveStorage(storage), STORAGE_KEYS.activeSession);
  return rawSession ? normalizeSession(rawSession, settings) : createInitialSession(settings);
}

export function saveActiveSession(session, storage) {
  writeJson(resolveStorage(storage), STORAGE_KEYS.activeSession, session);
}

export function loadFocusHistory(storage) {
  return normalizeFocusHistory(parseJson(resolveStorage(storage), STORAGE_KEYS.focusHistory));
}

export function saveFocusHistory(history, storage) {
  writeJson(resolveStorage(storage), STORAGE_KEYS.focusHistory, normalizeFocusHistory(history));
}

export function loadFocusHistoryLastExportedAt(storage) {
  return normalizeStoredTimestamp(
    parseJson(resolveStorage(storage), STORAGE_KEYS.focusHistoryLastExportedAt)
  );
}

export function saveFocusHistoryLastExportedAt(exportedAt, storage) {
  writeJson(
    resolveStorage(storage),
    STORAGE_KEYS.focusHistoryLastExportedAt,
    normalizeStoredTimestamp(exportedAt)
  );
}

export function loadFocusNoteDraft(storage) {
  return normalizeFocusNote(parseJson(resolveStorage(storage), STORAGE_KEYS.focusNoteDraft));
}

export function saveFocusNoteDraft(focusNoteDraft, storage) {
  writeJson(
    resolveStorage(storage),
    STORAGE_KEYS.focusNoteDraft,
    normalizeFocusNote(focusNoteDraft)
  );
}

export function createMemoryStorage(initialState = {}) {
  const store = new Map(Object.entries(initialState));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    }
  };
}
