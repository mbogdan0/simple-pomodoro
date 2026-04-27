import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSessionController } from '../../src/app/session/session-controller.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession, startCurrentStep, syncSession } from '../../src/core/session.js';
import { WORKER_ACTIONS } from '../../src/core/worker-protocol.js';

function createControllerHarness(stateOverrides = {}) {
  const state = {
    activeSession: null,
    focusHistory: [],
    idleStartedAt: null,
    lastCompletionKey: '',
    pauseStartedAt: null,
    settings: createDefaultSettings(),
    ...stateOverrides
  };
  const dispatchCompletionAlerts = vi.fn();
  const persistFocusHistory = vi.fn();
  const persistSession = vi.fn();
  const renderApp = vi.fn();
  const updateTimerLiveRegion = vi.fn();
  const updatePageChrome = vi.fn();
  const syncWorkerState = vi.fn();
  const controller = createSessionController({
    dispatchCompletionAlerts,
    persistFocusHistory,
    persistSession,
    renderApp,
    state,
    syncWorkerState,
    updatePageChrome,
    updateTimerLiveRegion
  });

  return {
    controller,
    dispatchCompletionAlerts,
    persistFocusHistory,
    persistSession,
    state
  };
}

describe('session advancement contracts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatches completion alerts only once per completion key', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 100);
    const harness = createControllerHarness({
      activeSession: running,
      settings
    });

    harness.controller.commitSession(completed, {
      dispatchAlerts: true,
      persist: true,
      render: false,
      syncWorker: false
    });
    harness.controller.commitSession(completed, {
      dispatchAlerts: true,
      persist: true,
      render: false,
      syncWorker: false
    });

    expect(harness.dispatchCompletionAlerts).toHaveBeenCalledTimes(1);
  });

  it('writes completed focus history entry once for duplicate completion commit', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 5_000);
    const completed = syncSession(running, running.endsAt + 200);
    const harness = createControllerHarness({
      activeSession: running,
      settings
    });

    harness.controller.commitSession(completed, {
      dispatchAlerts: true,
      persist: true,
      render: false,
      syncWorker: false
    });
    harness.controller.commitSession(completed, {
      dispatchAlerts: true,
      persist: true,
      render: false,
      syncWorker: false
    });

    expect(harness.state.focusHistory).toHaveLength(1);
    expect(harness.persistFocusHistory).toHaveBeenCalledTimes(1);
  });

  it('suppresses completion alerts for manual early completion action', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 10_000);
    const harness = createControllerHarness({
      activeSession: running,
      settings
    });

    harness.controller.handleLocalAction(WORKER_ACTIONS.END_STEP_EARLY, {
      now: 70_000
    });

    expect(harness.dispatchCompletionAlerts).not.toHaveBeenCalled();
    expect(harness.state.focusHistory).toHaveLength(1);
    expect(harness.state.focusHistory[0]?.durationMs).toBe(60_000);
    expect(harness.state.activeSession.status).toBe('idle');
  });

  it('tracks idle delay as transient app state only', () => {
    vi.useFakeTimers();

    const settings = createDefaultSettings();
    const initial = createInitialSession(settings);
    const harness = createControllerHarness({
      activeSession: initial,
      settings
    });

    vi.setSystemTime(1_000);
    harness.controller.commitSession(initial, {
      persist: true,
      render: false,
      syncWorker: false
    });

    expect(harness.state.idleStartedAt).toBe(1_000);
    expect(harness.persistSession).toHaveBeenCalledTimes(1);
    expect(harness.state.activeSession).not.toHaveProperty('idleStartedAt');

    vi.setSystemTime(2_000);
    harness.controller.commitSession(
      {
        ...initial,
        updatedAt: 2_000
      },
      {
        render: false,
        syncWorker: false
      }
    );

    expect(harness.state.idleStartedAt).toBe(1_000);

    vi.setSystemTime(3_000);
    harness.controller.handleLocalAction(WORKER_ACTIONS.START_STEP, {
      now: 3_000,
      settings
    });

    expect(harness.state.activeSession.status).toBe('running');
    expect(harness.state.idleStartedAt).toBeNull();

    vi.setSystemTime(4_000);
    harness.controller.handleLocalAction(WORKER_ACTIONS.END_STEP_EARLY, {
      now: 4_000
    });

    expect(harness.state.activeSession.status).toBe('idle');
    expect(harness.state.activeSession.currentStepIndex).toBe(1);
    expect(harness.state.idleStartedAt).toBe(4_000);
    expect(harness.state.activeSession).not.toHaveProperty('idleStartedAt');
  });

  it('tracks pause duration as transient app state only', () => {
    vi.useFakeTimers();

    const settings = createDefaultSettings();
    const initial = createInitialSession(settings);
    const harness = createControllerHarness({
      activeSession: initial,
      settings
    });

    vi.setSystemTime(1_000);
    harness.controller.handleLocalAction(WORKER_ACTIONS.START_STEP, {
      now: 1_000,
      settings
    });

    expect(harness.state.activeSession.status).toBe('running');
    expect(harness.state.pauseStartedAt).toBeNull();

    vi.setSystemTime(2_000);
    harness.controller.handleLocalAction(WORKER_ACTIONS.PAUSE, {
      now: 2_000
    });

    expect(harness.state.activeSession.status).toBe('paused');
    expect(harness.state.pauseStartedAt).toBe(2_000);
    expect(harness.state.activeSession).not.toHaveProperty('pauseStartedAt');

    vi.setSystemTime(3_000);
    harness.controller.commitSession(
      {
        ...harness.state.activeSession,
        updatedAt: 3_000
      },
      {
        render: false,
        syncWorker: false
      }
    );

    expect(harness.state.pauseStartedAt).toBe(2_000);

    vi.setSystemTime(4_000);
    harness.controller.handleLocalAction(WORKER_ACTIONS.RESUME, {
      now: 4_000
    });

    expect(harness.state.activeSession.status).toBe('running');
    expect(harness.state.pauseStartedAt).toBeNull();
  });
});
