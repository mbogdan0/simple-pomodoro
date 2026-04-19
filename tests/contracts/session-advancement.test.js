import { describe, expect, it, vi } from 'vitest';

import { createSessionController } from '../../src/app/session/session-controller.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import {
  createInitialSession,
  startCurrentStep,
  syncSession
} from '../../src/core/session.js';

function createControllerHarness(stateOverrides = {}) {
  const state = {
    activeSession: null,
    focusHistory: [],
    lastCompletionKey: '',
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
    state
  };
}

describe('session advancement contracts', () => {
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
});
