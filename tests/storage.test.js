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
  it('defaults picture-in-picture setting to disabled', () => {
    expect(createDefaultSettings().pipEnabled).toBe(false);
  });

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
        pipEnabled: 'yes',
        repeatCount: 0,
        autoStartNextStep: 'yes',
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
    expect(loaded.pipEnabled).toBe(false);
    expect(loaded.repeatCount).toBeGreaterThanOrEqual(1);
    expect(loaded.autoStartNextStep).toBe(false);
  });

  it('persists auto-start and pip choices', () => {
    const storage = createMemoryStorage();
    const settings = {
      ...createDefaultSettings(),
      autoStartNextStep: true,
      pipEnabled: true
    };

    saveSettings(settings, storage);

    expect(loadSettings(storage).autoStartNextStep).toBe(true);
    expect(loadSettings(storage).pipEnabled).toBe(true);
  });
});
