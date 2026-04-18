import { describe, expect, it } from 'vitest';

import {
  appendFocusHistoryEntry,
  createFocusHistoryEntry,
  removeFocusHistoryEntry
} from '../src/core/focus-history.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession, startCurrentStep, syncSession } from '../src/core/session.js';

function completeCurrentStep(session, startedAt = 1_000) {
  const running = startCurrentStep(session, startedAt);
  return syncSession(running, running.endsAt + 1_000);
}

describe('focus history helpers', () => {
  it('creates a history entry for completed focus steps', () => {
    const settings = createDefaultSettings();
    const completedFocus = completeCurrentStep(createInitialSession(settings));

    const entry = createFocusHistoryEntry(completedFocus);

    expect(entry).toMatchObject({
      durationMs: 25 * 60 * 1000,
      stepType: 'work'
    });
    expect(entry?.id).toBeTruthy();
    expect(entry?.stepId).toBe(completedFocus.scenario[0].id);
    expect(entry?.completedAt).toBe(completedFocus.finishedAt);
  });

  it('does not create history entries for completed non-focus steps', () => {
    const settings = createDefaultSettings();
    const base = createInitialSession(settings);

    const completedShortBreak = completeCurrentStep(
      {
        ...base,
        currentStepIndex: 1
      },
      2_000
    );

    expect(completedShortBreak.scenario[completedShortBreak.currentStepIndex].type).toBe('shortBreak');
    expect(createFocusHistoryEntry(completedShortBreak)).toBe(null);
  });

  it('deduplicates entries by id and supports removing single entries', () => {
    const settings = createDefaultSettings();
    const completedFocus = completeCurrentStep(createInitialSession(settings));
    const entry = createFocusHistoryEntry(completedFocus);

    if (!entry) {
      throw new Error('Expected focus history entry to be created.');
    }

    const withFirstEntry = appendFocusHistoryEntry([], entry);
    const withDuplicate = appendFocusHistoryEntry(withFirstEntry, entry);

    expect(withFirstEntry).toHaveLength(1);
    expect(withDuplicate).toHaveLength(1);
    expect(removeFocusHistoryEntry(withDuplicate, entry.id)).toEqual([]);
  });
});
