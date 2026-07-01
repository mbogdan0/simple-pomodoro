import { describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '../src/core/constants.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession } from '../src/core/session.js';
import {
  createMemoryStorage,
  loadActiveSession,
  loadFocusHistory,
  loadFocusHistoryLastExportedAt,
  loadFocusNoteDraft,
  loadSettings,
  saveActiveSession,
  saveFocusHistory,
  saveFocusHistoryLastExportedAt,
  saveFocusNoteDraft,
  saveSettings
} from '../src/core/storage.js';

describe('storage layer', () => {
  it('defaults picture-in-picture clock rounding to disabled', () => {
    expect(createDefaultSettings().pipClockTickEvery10s).toBe(false);
    expect(createDefaultSettings().ntfyPublishUrl).toBe('');
    expect(createDefaultSettings()).not.toHaveProperty('pipEnabled');
  });

  it('roundtrips settings and active session through localStorage abstraction', () => {
    const storage = createMemoryStorage();
    const settings = createDefaultSettings();
    const session = createInitialSession(settings);
    const history = [
      {
        completedAt: 1_710_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusTag: 'study',
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

  it('roundtrips focus note draft through localStorage abstraction', () => {
    const storage = createMemoryStorage();
    saveFocusNoteDraft('Deep work on architecture review', storage);

    expect(loadFocusNoteDraft(storage)).toBe('Deep work on architecture revi');
  });

  it('roundtrips and normalizes the last focus history export timestamp', () => {
    const storage = createMemoryStorage();

    saveFocusHistoryLastExportedAt(1_780_000_000_000.8, storage);

    expect(loadFocusHistoryLastExportedAt(storage)).toBe(1_780_000_000_001);

    saveFocusHistoryLastExportedAt(-1, storage);

    expect(loadFocusHistoryLastExportedAt(storage)).toBeNull();
  });

  it('normalizes repeat count and unsupported tabs while loading settings', () => {
    const storage = createMemoryStorage();

    saveSettings(
      {
        infiniteCycleEnabled: 'yes',
        lastOpenTab: 'unknown-tab',
        ntfyPublishUrl: 'ntfy.sh/my-topic',
        pipClockTickEvery10s: 'yes',
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
    expect(loaded.ntfyPublishUrl).toBe('');
    expect(loaded.pipClockTickEvery10s).toBe(false);
    expect(loaded.infiniteCycleEnabled).toBe(false);
    expect(loaded).not.toHaveProperty('pipEnabled');
    expect(loaded).not.toHaveProperty('autoStartNextStep');
    expect(loaded.repeatCount).toBeGreaterThanOrEqual(1);
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
          focusTag: 'work',
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
        focusTag: 'work',
        id: 'step-1:1710000000000',
        stepId: 'step-1',
        stepType: 'work'
      }
    ]);
  });

  it('persists infinite mode and PiP clock choices', () => {
    const storage = createMemoryStorage();
    const settings = {
      ...createDefaultSettings(),
      infiniteCycleEnabled: true,
      ntfyPublishUrl: 'https://ntfy.sh/fizjuz-bowFek-kofhi2',
      pipClockTickEvery10s: true
    };

    saveSettings(settings, storage);

    expect(loadSettings(storage).infiniteCycleEnabled).toBe(true);
    expect(loadSettings(storage).ntfyPublishUrl).toBe('https://ntfy.sh/fizjuz-bowFek-kofhi2');
    expect(loadSettings(storage).pipClockTickEvery10s).toBe(true);
    expect(loadSettings(storage)).not.toHaveProperty('pipEnabled');
  });

  it('normalizes unsupported ntfy URL schemes to empty', () => {
    const storage = createMemoryStorage();

    saveSettings(
      {
        ...createDefaultSettings(),
        ntfyPublishUrl: 'file:///tmp/notify'
      },
      storage
    );

    expect(loadSettings(storage).ntfyPublishUrl).toBe('');
  });

  it('falls back to in-memory storage when provided storage throws', () => {
    const throwingStorage = {
      getItem() {
        throw new Error('Storage read is blocked.');
      },
      removeItem() {
        throw new Error('Storage remove is blocked.');
      },
      setItem() {
        throw new Error('Storage write is blocked.');
      }
    };
    const settings = {
      ...createDefaultSettings(),
      repeatCount: 3
    };

    expect(() => saveSettings(settings, throwingStorage)).not.toThrow();
    expect(() => saveFocusHistoryLastExportedAt(1_780_000_000_000, throwingStorage)).not.toThrow();
    expect(loadSettings(throwingStorage).repeatCount).toBe(3);
    expect(loadFocusHistoryLastExportedAt(throwingStorage)).toBe(1_780_000_000_000);
  });
});
