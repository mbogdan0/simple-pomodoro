import { describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '../src/core/constants.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession } from '../src/core/session.js';
import {
  createMemoryStorage,
  loadActiveSession,
  loadFocusHistory,
  loadSettings,
  saveActiveSession,
  saveFocusHistory,
  saveSettings
} from '../src/core/storage.js';

describe('storage layer', () => {
  it('defaults picture-in-picture setting to disabled', () => {
    expect(createDefaultSettings().pipEnabled).toBe(false);
    expect(createDefaultSettings().pipClockTickEvery10s).toBe(false);
  });

  it('roundtrips settings and active session through localStorage abstraction', () => {
    const storage = createMemoryStorage();
    const settings = createDefaultSettings();
    const session = createInitialSession(settings);
    const history = [
      {
        completedAt: 1_710_000_000_000,
        durationMs: 25 * 60 * 1000,
        id: 'step-1:1710000000000',
        stepId: 'step-1',
        stepType: 'work'
      }
    ];

    saveSettings(settings, storage);
    saveActiveSession(session, storage);
    saveFocusHistory(history, storage);

    expect(loadSettings(storage)).toEqual(settings);
    expect(loadActiveSession(settings, storage)).toEqual(session);
    expect(loadFocusHistory(storage)).toEqual(history);
  });

  it('normalizes repeat count and unsupported tabs while loading settings', () => {
    const storage = createMemoryStorage();

    saveSettings(
      {
        lastOpenTab: 'unknown-tab',
        pipEnabled: 'yes',
        pipClockTickEvery10s: 'yes',
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
    expect(loaded.pipClockTickEvery10s).toBe(false);
    expect(loaded.repeatCount).toBeGreaterThanOrEqual(1);
    expect(loaded.autoStartNextStep).toBe(false);
  });

  it('keeps history as a valid last-open tab', () => {
    const storage = createMemoryStorage();

    saveSettings(
      {
        ...createDefaultSettings(),
        lastOpenTab: 'history'
      },
      storage
    );

    expect(loadSettings(storage).lastOpenTab).toBe('history');
  });

  it('filters broken history records when loading from storage', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.focusHistory]: JSON.stringify([
        {
          completedAt: 1_710_000_000_000,
          durationMs: 25 * 60 * 1000,
          id: 'step-1:1710000000000',
          stepId: 'step-1',
          stepType: 'work'
        },
        {
          completedAt: 'bad',
          durationMs: 15 * 60 * 1000,
          id: 'broken',
          stepId: 'step-2',
          stepType: 'work'
        },
        {
          durationMs: 20 * 60 * 1000,
          id: 'broken-2',
          stepType: 'work'
        }
      ])
    });

    expect(loadFocusHistory(storage)).toEqual([
      {
        completedAt: 1_710_000_000_000,
        durationMs: 25 * 60 * 1000,
        id: 'step-1:1710000000000',
        stepId: 'step-1',
        stepType: 'work'
      }
    ]);
  });

  it('persists auto-start and pip choices', () => {
    const storage = createMemoryStorage();
    const settings = {
      ...createDefaultSettings(),
      autoStartNextStep: true,
      pipEnabled: true,
      pipClockTickEvery10s: true
    };

    saveSettings(settings, storage);

    expect(loadSettings(storage).autoStartNextStep).toBe(true);
    expect(loadSettings(storage).pipEnabled).toBe(true);
    expect(loadSettings(storage).pipClockTickEvery10s).toBe(true);
  });
});
