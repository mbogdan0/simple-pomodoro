import { describe, expect, it } from 'vitest';

import { MAX_FOCUS_HISTORY_ENTRIES } from '../src/core/constants.js';
import {
  appendFocusHistoryEntry,
  createFocusHistoryEntry,
  normalizeFocusHistoryEntry,
  removeFocusHistoryEntry,
  updateFocusHistoryEntryFocusTag
} from '../src/core/focus-history.js';
import { createDefaultSettings } from '../src/core/settings.js';
import {
  createInitialSession,
  forceCompleteCurrentStep,
  setSessionFocusTag,
  startCurrentStep,
  syncSession
} from '../src/core/session.js';

function completeCurrentStep(session, startedAt = 1_000) {
  const running = startCurrentStep(session, startedAt);
  return syncSession(running, running.endsAt + 1_000);
}

describe('focus history helpers', () => {
  it('creates a history entry for completed focus steps', () => {
    const settings = createDefaultSettings();
    const taggedSession = setSessionFocusTag(createInitialSession(settings), 'study', 1_050);
    const completedFocus = completeCurrentStep(taggedSession);

    const entry = createFocusHistoryEntry(completedFocus);

    expect(entry).toMatchObject({
      durationMs: 25 * 60 * 1000,
      focusTag: 'study',
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

    expect(completedShortBreak.scenario[completedShortBreak.currentStepIndex].type).toBe(
      'shortBreak'
    );
    expect(createFocusHistoryEntry(completedShortBreak)).toBe(null);
  });

  it('stores actual elapsed duration for early-ended focus steps', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 10_000);
    const earlyCompleted = forceCompleteCurrentStep(running, 70_000);

    const entry = createFocusHistoryEntry(earlyCompleted);

    expect(entry).toMatchObject({
      durationMs: 60_000,
      stepType: 'work'
    });
  });

  it('keeps full planned duration for naturally completed focus steps', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 10_000);
    const completed = syncSession(running, running.endsAt + 500);

    const entry = createFocusHistoryEntry(completed);

    expect(entry?.durationMs).toBe(settings.templateDurations.work);
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

  it('does not update history tag for unknown entry id or invalid tag', () => {
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

    expect(updateFocusHistoryEntryFocusTag(history, 'missing', 'study')).toEqual(history);
    expect(updateFocusHistoryEntryFocusTag(history, 'focus-1', 'deep')).toEqual(history);
  });
});
