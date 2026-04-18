import { STORAGE_KEYS } from './constants.js';
import { createDefaultSettings, normalizeSettings } from './settings.js';
import { createInitialSession, normalizeSession } from './session.js';

function getBrowserStorage() {
  if (!globalThis.localStorage) {
    throw new Error('localStorage is not available in this environment.');
  }

  return globalThis.localStorage;
}

function parseJson(storage, key) {
  const rawValue = storage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

export function loadSettings(storage = getBrowserStorage()) {
  return normalizeSettings(parseJson(storage, STORAGE_KEYS.settings) ?? createDefaultSettings());
}

export function saveSettings(settings, storage = getBrowserStorage()) {
  writeJson(storage, STORAGE_KEYS.settings, settings);
}

export function loadActiveSession(settings, storage = getBrowserStorage()) {
  const rawSession = parseJson(storage, STORAGE_KEYS.activeSession);
  return rawSession ? normalizeSession(rawSession, settings) : createInitialSession(settings);
}

export function saveActiveSession(session, storage = getBrowserStorage()) {
  writeJson(storage, STORAGE_KEYS.activeSession, session);
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
