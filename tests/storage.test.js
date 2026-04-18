import { describe, expect, it } from 'vitest';

import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession } from '../src/core/session.js';
import {
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
});
