import { describe, expect, it } from 'vitest';

import { reduceCommittedSession } from '../../src/app/session/session-commit-reducer.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import {
  createInitialSession,
  pauseSession,
  startCurrentStep,
  syncSession
} from '../../src/core/session.js';

function createReducerInput(overrides = {}) {
  const settings = overrides.settings ?? createDefaultSettings();
  const baseSession = createInitialSession(settings);

  return {
    commitNow: 2_000,
    completionKeyHint: '',
    completionReason: '',
    dispatchAlerts: false,
    focusHistory: [],
    focusNoteDraft: '',
    historyEntryHint: null,
    idleStartedAt: null,
    lastCompletionKey: '',
    nextSession: baseSession,
    pauseStartedAt: null,
    previousSession: baseSession,
    settings,
    ...overrides
  };
}

describe('session commit reducer', () => {
  it('keeps idle started timestamp when staying on the same idle step', () => {
    const settings = createDefaultSettings();
    const initial = createInitialSession(settings);
    const reduced = reduceCommittedSession(
      createReducerInput({
        commitNow: 5_000,
        idleStartedAt: 1_000,
        nextSession: {
          ...initial,
          updatedAt: 4_999
        },
        previousSession: initial,
        settings
      })
    );

    expect(reduced.idleStartedAt).toBe(1_000);
  });

  it('resets idle started timestamp when idle step changes', () => {
    const settings = createDefaultSettings();
    const initial = createInitialSession(settings);
    const reduced = reduceCommittedSession(
      createReducerInput({
        commitNow: 5_000,
        idleStartedAt: 1_000,
        nextSession: {
          ...initial,
          currentStepIndex: 1,
          updatedAt: 4_999
        },
        previousSession: initial,
        settings
      })
    );

    expect(reduced.idleStartedAt).toBe(5_000);
  });

  it('sets and preserves pause started timestamp while paused', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const paused = pauseSession(running, 2_000);

    const reducedToPaused = reduceCommittedSession(
      createReducerInput({
        commitNow: 3_000,
        nextSession: paused,
        previousSession: running,
        settings
      })
    );

    expect(reducedToPaused.pauseStartedAt).toBe(3_000);

    const reducedStillPaused = reduceCommittedSession(
      createReducerInput({
        commitNow: 4_000,
        nextSession: {
          ...paused,
          updatedAt: 3_999
        },
        pauseStartedAt: reducedToPaused.pauseStartedAt,
        previousSession: paused,
        settings
      })
    );

    expect(reducedStillPaused.pauseStartedAt).toBe(3_000);
  });

  it('suppresses manual early completion alerts and still advances session', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 10_000);
    const completed = syncSession(running, running.endsAt + 100);
    const reduced = reduceCommittedSession(
      createReducerInput({
        commitNow: running.endsAt + 100,
        completionReason: 'manual_early',
        dispatchAlerts: true,
        focusNoteDraft: 'Ship release checklist',
        nextSession: completed,
        previousSession: running,
        settings
      })
    );

    expect(reduced.completionAlerts).toHaveLength(0);
    expect(reduced.focusHistory).toHaveLength(1);
    expect(reduced.shouldPersistFocusHistory).toBe(true);
    expect(reduced.lastCompletionKey).not.toBe('');
    expect(reduced.session.status).toBe('idle');
  });
});
