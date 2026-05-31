import { describe, expect, it, vi } from 'vitest';

import {
  STALE_SESSION_THRESHOLD_MS,
  applyStartupSessionPolicy,
  shouldConfirmStaleSession
} from '../../src/app/session/startup-session.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession, syncSession } from '../../src/core/session.js';
import { WORKER_ACTIONS } from '../../src/core/worker-protocol.js';

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

  it('resets stale startup session when confirmation is accepted', () => {
    const now = 1_000_000;
    const state = createState({
      currentStepIndex: 3,
      updatedAt: now - STALE_SESSION_THRESHOLD_MS - 10
    });
    const clearFocusNoteDraft = vi.fn();
    const commitSession = vi.fn();
    const handleLocalAction = vi.fn();

    applyStartupSessionPolicy({
      clearFocusNoteDraft,
      commitSession,
      confirmStaleSession: () => true,
      handleLocalAction,
      now,
      state
    });

    expect(clearFocusNoteDraft).toHaveBeenCalledTimes(1);
    expect(handleLocalAction).toHaveBeenCalledWith(WORKER_ACTIONS.RESET_ALL, {
      now,
      settings: state.settings
    });
    expect(commitSession).not.toHaveBeenCalled();
  });

  it('commits synced startup session when stale confirmation is declined', () => {
    const now = 1_000_000;
    const state = createState({
      currentStepIndex: 2,
      updatedAt: now - STALE_SESSION_THRESHOLD_MS - 10
    });
    const clearFocusNoteDraft = vi.fn();
    const commitSession = vi.fn();
    const handleLocalAction = vi.fn();

    applyStartupSessionPolicy({
      clearFocusNoteDraft,
      commitSession,
      confirmStaleSession: () => false,
      handleLocalAction,
      now,
      state
    });

    expect(clearFocusNoteDraft).not.toHaveBeenCalled();
    expect(handleLocalAction).not.toHaveBeenCalled();
    expect(commitSession).toHaveBeenCalledWith(syncSession(state.activeSession, now), {
      dispatchAlerts: true,
      persist: true,
      render: false,
      syncWorker: false
    });
  });
});
