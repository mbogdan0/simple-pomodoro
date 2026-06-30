import { describe, expect, it, vi } from 'vitest';

import {
  STALE_SESSION_THRESHOLD_MS,
  applyStartupSessionPolicy,
  shouldConfirmStaleSession
} from '../../src/app/session/startup-session.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession, syncSession } from '../../src/core/session.js';

function createState(activeSessionOverrides = {}) {
  const settings = createDefaultSettings();
  return {
    activeSession: {
      ...createInitialSession(settings),
      ...activeSessionOverrides
    },
    settings
  };
}

describe('startup session policy', () => {
  it('recognizes stale resettable sessions for confirmation', () => {
    const now = 1_000_000;
    const state = createState({
      currentStepIndex: 2,
      updatedAt: now - STALE_SESSION_THRESHOLD_MS
    });

    expect(shouldConfirmStaleSession(state.activeSession, now)).toBe(true);
  });

  it('skips stale confirmation for a fresh initial session', () => {
    const now = 1_000_000;
    const state = createState({
      currentStepIndex: 0,
      status: 'idle',
      updatedAt: now - STALE_SESSION_THRESHOLD_MS - 1
    });

    expect(shouldConfirmStaleSession(state.activeSession, now)).toBe(false);
  });

  it('opens stale-session modal while committing synced startup session', () => {
    const now = 1_000_000;
    const state = createState({
      currentStepIndex: 3,
      updatedAt: now - STALE_SESSION_THRESHOLD_MS - 10
    });
    const commitSession = vi.fn();

    applyStartupSessionPolicy({
      commitSession,
      now,
      state
    });

    expect(state.modal).toEqual({ type: 'stale-session' });
    expect(commitSession).toHaveBeenCalledWith(syncSession(state.activeSession, now), {
      dispatchAlerts: true,
      persist: true,
      render: false,
      syncWorker: false
    });
  });

  it('commits synced startup session without modal for fresh session', () => {
    const now = 1_000_000;
    const state = createState({
      currentStepIndex: 0,
      updatedAt: now
    });
    const commitSession = vi.fn();

    applyStartupSessionPolicy({
      commitSession,
      now,
      state
    });

    expect(state.modal).toBeUndefined();
    expect(commitSession).toHaveBeenCalledWith(syncSession(state.activeSession, now), {
      dispatchAlerts: true,
      persist: true,
      render: false,
      syncWorker: false
    });
  });
});
