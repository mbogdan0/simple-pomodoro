import { describe, expect, it } from 'vitest';

import { LEGACY_STORAGE_KEYS } from '../src/core/constants.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession } from '../src/core/session.js';
import {
  clearLegacyStorage,
  createMemoryStorage,
  loadActiveSession,
  loadSettings,
  saveActiveSession,
  saveSettings
} from '../src/core/storage.js';

describe('storage layer', () => {
  it('roundtrips settings and active session through localStorage abstraction', () => {
    const storage = createMemoryStorage();
    const settings = createDefaultSettings();
    const session = createInitialSession(settings);

    saveSettings(settings, storage);
    saveActiveSession(session, storage);

    expect(loadSettings(storage)).toEqual(settings);
    expect(loadActiveSession(settings, storage)).toEqual(session);
  });

  it('normalizes repeat count and supported tabs while loading settings', () => {
    const storage = createMemoryStorage();

    saveSettings(
      {
        lastOpenTab: 'history',
        repeatCount: 0,
        templateDurations: {
          longBreak: 15 * 60 * 1000,
          shortBreak: 5 * 60 * 1000,
          work: 25 * 60 * 1000
        }
      },
      storage
    );

    const loaded = loadSettings(storage);

    expect(loaded.lastOpenTab).toBe('timer');
    expect(loaded.repeatCount).toBeGreaterThanOrEqual(1);
  });

  it('clears legacy pomodoro-orbit keys without touching new ones', () => {
    const initialState = {
      [LEGACY_STORAGE_KEYS[0]]: '{"legacy":true}',
      [LEGACY_STORAGE_KEYS[1]]: '[]',
      [LEGACY_STORAGE_KEYS[2]]: '{"legacy":true}',
      'timer.settings.v2': '{"keep":true}'
    };
    const storage = createMemoryStorage(initialState);

    clearLegacyStorage(storage);

    expect(storage.getItem(LEGACY_STORAGE_KEYS[0])).toBeNull();
    expect(storage.getItem(LEGACY_STORAGE_KEYS[1])).toBeNull();
    expect(storage.getItem(LEGACY_STORAGE_KEYS[2])).toBeNull();
    expect(storage.getItem('timer.settings.v2')).toBe('{"keep":true}');
  });
});
