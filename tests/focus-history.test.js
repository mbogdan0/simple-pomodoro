import { describe, expect, it } from 'vitest';

import { MAX_FOCUS_HISTORY_ENTRIES } from '../src/core/constants.js';
import {
  appendFocusHistoryEntry,
  createFocusHistoryBackupStatus,
  createFocusHistoryEntry,
  createFocusHistoryExportPayload,
  mergeFocusHistory,
  normalizeFocusHistoryEntry,
  parseFocusHistoryImportPayload,
  removeFocusHistoryEntry,
  updateFocusHistoryEntryFocusNote,
  updateFocusHistoryEntryFocusTag
} from '../src/core/focus-history.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession, setSessionFocusTag } from '../src/core/session.js';

function createEntry(overrides = {}) {
  const settings = createDefaultSettings();
  const session = setSessionFocusTag(createInitialSession(settings), 'study', 1_050);

  return createFocusHistoryEntry({
    completedAt: 95_000,
    durationMs: 75_000,
    focusNote: '',
    session,
    ...overrides
  });
}

describe('focus history helpers', () => {
  it('creates a history entry for an explicit focus save', () => {
    const settings = createDefaultSettings();
    const taggedSession = setSessionFocusTag(createInitialSession(settings), 'study', 1_050);

    const entry = createFocusHistoryEntry({
      completedAt: 95_000,
      durationMs: 75_000,
      focusNote: 'Write launch checklist and test migration flows',
      session: taggedSession
    });

    expect(entry).toMatchObject({
      completedAt: 95_000,
      durationMs: 75_000,
      focusNote: 'Write launch checklist and tes',
      focusTag: 'study',
      stepType: 'work'
    });
    expect(entry?.id).toBe(`${taggedSession.scenario[0].id}:95000`);
    expect(entry?.stepId).toBe(taggedSession.scenario[0].id);
  });

  it('does not create history entries for non-focus steps', () => {
    const settings = createDefaultSettings();
    const base = createInitialSession(settings);

    const entry = createFocusHistoryEntry({
      completedAt: 95_000,
      durationMs: 75_000,
      session: {
        ...base,
        currentStepIndex: 1
      }
    });

    expect(entry).toBe(null);
  });

  it('stores either actual or planned duration as the entry duration', () => {
    const settings = createDefaultSettings();
    const session = createInitialSession(settings);
    const actual = createFocusHistoryEntry({
      completedAt: 95_000,
      durationMs: 75_000,
      idHint: 'actual-entry',
      session
    });
    const planned = createFocusHistoryEntry({
      completedAt: 96_000,
      durationMs: settings.templateDurations.work,
      idHint: 'planned-entry',
      session
    });

    expect(actual?.durationMs).toBe(75_000);
    expect(planned?.durationMs).toBe(settings.templateDurations.work);
  });

  it('deduplicates entries by id and supports removing single entries', () => {
    const entry = createEntry();

    if (!entry) {
      throw new Error('Expected focus history entry to be created.');
    }

    const withFirstEntry = appendFocusHistoryEntry([], entry);
    const withDuplicate = appendFocusHistoryEntry(withFirstEntry, entry);

    expect(withFirstEntry).toHaveLength(1);
    expect(withDuplicate).toHaveLength(1);
    expect(removeFocusHistoryEntry(withDuplicate, entry.id)).toEqual([]);
  });

  it('keeps focus history bounded to the most recent entries', () => {
    const history = [];

    for (let index = 0; index < MAX_FOCUS_HISTORY_ENTRIES + 25; index += 1) {
      const next = {
        completedAt: 1_710_000_000_000 + index,
        durationMs: 25 * 60 * 1000,
        focusTag: 'none',
        id: `step-${index}`,
        stepId: `step-${index}`,
        stepType: 'work'
      };
      history.unshift(next);
    }

    const appended = appendFocusHistoryEntry(history, {
      completedAt: 1_720_000_000_000,
      durationMs: 25 * 60 * 1000,
      focusTag: 'study',
      id: 'latest-step',
      stepId: 'latest-step',
      stepType: 'work'
    });

    expect(appended).toHaveLength(MAX_FOCUS_HISTORY_ENTRIES);
    expect(appended[0].id).toBe('latest-step');
  });

  it('defaults missing or invalid history tag values to none', () => {
    expect(
      normalizeFocusHistoryEntry({
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        id: 'missing-tag',
        stepId: 'step-id',
        stepType: 'work'
      })?.focusTag
    ).toBe('none');

    expect(
      normalizeFocusHistoryEntry({
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusTag: 'deep',
        id: 'bad-tag',
        stepId: 'step-id',
        stepType: 'work'
      })?.focusTag
    ).toBe('none');
  });

  it('normalizes history focus note values to max 30 chars', () => {
    expect(
      normalizeFocusHistoryEntry({
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusNote: 'Keep calm and review pull request diffs carefully',
        focusTag: 'work',
        id: 'with-note',
        stepId: 'step-id',
        stepType: 'work'
      })?.focusNote
    ).toBe('Keep calm and review pull requ');

    expect(
      normalizeFocusHistoryEntry({
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusNote: 123,
        focusTag: 'work',
        id: 'bad-note',
        stepId: 'step-id',
        stepType: 'work'
      })?.focusNote
    ).toBeUndefined();
  });

  it('updates only selected history entry tag', () => {
    const history = [
      {
        completedAt: 1_720_000_000_100,
        durationMs: 25 * 60 * 1000,
        focusTag: 'none',
        id: 'focus-1',
        stepId: 'focus-1',
        stepType: 'work'
      },
      {
        completedAt: 1_720_000_000_200,
        durationMs: 25 * 60 * 1000,
        focusTag: 'work',
        id: 'focus-2',
        stepId: 'focus-2',
        stepType: 'work'
      }
    ];

    const updated = updateFocusHistoryEntryFocusTag(history, 'focus-2', 'study');

    expect(updated).toHaveLength(2);
    expect(updated[0]).toMatchObject({ id: 'focus-1', focusTag: 'none' });
    expect(updated[1]).toMatchObject({ id: 'focus-2', focusTag: 'study' });
  });

  it('updates and clears focus notes on selected history entries', () => {
    const history = [
      {
        completedAt: 1_720_000_000_100,
        durationMs: 25 * 60 * 1000,
        focusTag: 'none',
        id: 'focus-1',
        stepId: 'focus-1',
        stepType: 'work'
      }
    ];

    const withNote = updateFocusHistoryEntryFocusNote(history, 'focus-1', 'Review release notes');
    const cleared = updateFocusHistoryEntryFocusNote(withNote, 'focus-1', '');

    expect(withNote[0].focusNote).toBe('Review release notes');
    expect(cleared[0].focusNote).toBeUndefined();
  });

  it('creates and parses focus history export payloads', () => {
    const history = [
      {
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusTag: 'work',
        id: 'focus-1',
        stepId: 'step-1',
        stepType: 'work'
      }
    ];
    const payload = createFocusHistoryExportPayload(history, 1_780_000_000_000);
    const parsed = parseFocusHistoryImportPayload(payload);

    expect(payload).toMatchObject({
      app: 'Simple Pomodoro Timer',
      exportedAt: 1_780_000_000_000,
      version: 1
    });
    expect(parsed.error).toBe('');
    expect(parsed.focusHistory).toEqual(history);
    expect(parseFocusHistoryImportPayload(history).focusHistory).toEqual(history);
    expect(parseFocusHistoryImportPayload({ focusHistory: [{ id: '' }] }).error).toBe(
      'No valid focus history entries were found.'
    );
  });

  it('merges imported focus history without duplicate ids or natural duplicate sessions', () => {
    const localHistory = [
      {
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusNote: 'Local note',
        focusTag: 'work',
        id: 'focus-1',
        stepId: 'step-1',
        stepType: 'work'
      }
    ];
    const importedHistory = [
      {
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusNote: 'Imported note',
        focusTag: 'study',
        id: 'focus-1',
        stepId: 'step-1',
        stepType: 'work'
      },
      {
        completedAt: 1_720_000_000_000,
        durationMs: 25 * 60 * 1000,
        focusTag: 'study',
        id: 'alternate-id',
        stepId: 'step-1',
        stepType: 'work'
      },
      {
        completedAt: 1_730_000_000_000,
        durationMs: 30 * 60 * 1000,
        focusTag: 'study',
        id: 'focus-2',
        stepId: 'step-2',
        stepType: 'work'
      }
    ];

    const merged = mergeFocusHistory(localHistory, importedHistory);

    expect(merged.addedCount).toBe(1);
    expect(merged.skippedCount).toBe(2);
    expect(merged.history).toEqual([
      {
        completedAt: 1_730_000_000_000,
        durationMs: 30 * 60 * 1000,
        focusTag: 'study',
        id: 'focus-2',
        stepId: 'step-2',
        stepType: 'work'
      },
      localHistory[0]
    ]);
  });

  it('keeps merged history newest-first and bounded', () => {
    const localHistory = [];
    const importedHistory = [];

    for (let index = 0; index < MAX_FOCUS_HISTORY_ENTRIES + 10; index += 1) {
      importedHistory.push({
        completedAt: 1_720_000_000_000 + index,
        durationMs: 25 * 60 * 1000,
        focusTag: 'none',
        id: `focus-${index}`,
        stepId: `step-${index}`,
        stepType: 'work'
      });
    }

    const merged = mergeFocusHistory(localHistory, importedHistory);

    expect(merged.history).toHaveLength(MAX_FOCUS_HISTORY_ENTRIES);
    expect(merged.history[0].id).toBe(`focus-${MAX_FOCUS_HISTORY_ENTRIES + 9}`);
  });

  it('creates smart backup warning status only for stale exports with 21+ days of history', () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date(2026, 6, 1).getTime();
    const history = [
      {
        completedAt: now - 22 * dayMs,
        durationMs: 25 * 60 * 1000,
        focusTag: 'none',
        id: 'old',
        stepId: 'old',
        stepType: 'work'
      },
      {
        completedAt: now,
        durationMs: 25 * 60 * 1000,
        focusTag: 'none',
        id: 'new',
        stepId: 'new',
        stepType: 'work'
      }
    ];

    expect(createFocusHistoryBackupStatus(history, null, now)).toMatchObject({
      isWarning: true,
      label: 'Last backup: never'
    });
    expect(createFocusHistoryBackupStatus(history, now, now)).toMatchObject({
      isWarning: false,
      label: 'Last backup: today'
    });
    expect(createFocusHistoryBackupStatus(history.slice(1), null, now).isWarning).toBe(false);
  });
});
