import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSessionController } from '../../src/app/session/session-controller.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession, pauseSession, startCurrentStep } from '../../src/core/session.js';
import { WORKER_ACTIONS, WORKER_MESSAGE_TYPES } from '../../src/core/worker-protocol.js';

const originalSelf = globalThis.self;

function createControllerHarness(initialSession, settings) {
  const state = {
    activeSession: initialSession,
    focusHistory: [],
    focusNoteDraft: '',
    idleStartedAt: null,
    lastCompletionKey: '',
    pauseStartedAt: null,
    settings
  };
  const controller = createSessionController({
    dispatchCompletionAlerts: vi.fn(),
    persistFocusHistory: vi.fn(),
    persistSession: vi.fn(),
    renderApp: vi.fn(),
    state,
    syncWorkerState: vi.fn(),
    updatePageChrome: vi.fn(),
    updateTimerLiveRegion: vi.fn()
  });

  return {
    controller,
    state
  };
}

async function runWorkerAction(initialSession, type, payload = {}) {
  const emitted = [];
  const harness = {
    onmessage: null,
    postMessage(message) {
      emitted.push(message);
    }
  };

  vi.resetModules();
  globalThis.self = harness;
  await import('../../src/worker.js');

  harness.onmessage({
    data: {
      payload: {
        session: initialSession
      },
      type: WORKER_ACTIONS.INIT
    }
  });

  harness.onmessage({
    data: {
      payload,
      type
    }
  });

  const actionResult = emitted.at(-1);

  harness.onmessage({
    data: {
      payload: {
        now: (payload.now ?? Date.now()) + 1,
        settings: payload.settings
      },
      type: WORKER_ACTIONS.RESET_ALL
    }
  });

  return actionResult;
}

function toComparableSession(session) {
  const rest = {
    ...session
  };
  delete rest.updatedAt;

  return {
    ...rest,
    scenario: (rest.scenario ?? []).map((step) => ({
      durationMs: step.durationMs,
      type: step.type
    }))
  };
}

function expectParity(localState, workerState) {
  expect(toComparableSession(workerState.activeSession)).toEqual(
    toComparableSession(localState.activeSession)
  );
  expect(workerState.lastCompletionKey).toBe(localState.lastCompletionKey);
  expect(workerState.focusHistory).toEqual(localState.focusHistory);
}

describe('session action parity between local fallback and worker path', () => {
  afterEach(() => {
    globalThis.self = originalSelf;
    vi.restoreAllMocks();
  });

  it('keeps START_STEP parity', async () => {
    const settings = createDefaultSettings();
    const initialSession = createInitialSession(settings);
    const payload = {
      now: 2_000,
      settings
    };
    const localHarness = createControllerHarness(initialSession, settings);
    const workerHarness = createControllerHarness(initialSession, settings);

    localHarness.controller.handleLocalAction(WORKER_ACTIONS.START_STEP, payload);
    const workerMessage = await runWorkerAction(initialSession, WORKER_ACTIONS.START_STEP, payload);

    expect(workerMessage?.type).toBe(WORKER_MESSAGE_TYPES.STATE);
    workerHarness.controller.commitSession(workerMessage.session, {
      dispatchAlerts: true,
      persist: true,
      render: true,
      syncWorker: false
    });

    expectParity(localHarness.state, workerHarness.state);
  });

  it('keeps PAUSE parity', async () => {
    const settings = createDefaultSettings();
    const startNow = Date.now();
    const initialSession = startCurrentStep(createInitialSession(settings), startNow);
    const payload = {
      now: startNow + 2_000
    };
    const localHarness = createControllerHarness(initialSession, settings);
    const workerHarness = createControllerHarness(initialSession, settings);

    localHarness.controller.handleLocalAction(WORKER_ACTIONS.PAUSE, payload);
    const workerMessage = await runWorkerAction(initialSession, WORKER_ACTIONS.PAUSE, payload);

    expect(workerMessage?.type).toBe(WORKER_MESSAGE_TYPES.STATE);
    workerHarness.controller.commitSession(workerMessage.session, {
      dispatchAlerts: true,
      persist: true,
      render: true,
      syncWorker: false
    });

    expectParity(localHarness.state, workerHarness.state);
  });

  it('keeps RESUME parity', async () => {
    const settings = createDefaultSettings();
    const startNow = Date.now();
    const running = startCurrentStep(createInitialSession(settings), startNow);
    const initialSession = pauseSession(running, startNow + 1_000);
    const payload = {
      now: startNow + 2_000
    };
    const localHarness = createControllerHarness(initialSession, settings);
    const workerHarness = createControllerHarness(initialSession, settings);

    localHarness.controller.handleLocalAction(WORKER_ACTIONS.RESUME, payload);
    const workerMessage = await runWorkerAction(initialSession, WORKER_ACTIONS.RESUME, payload);

    expect(workerMessage?.type).toBe(WORKER_MESSAGE_TYPES.STATE);
    workerHarness.controller.commitSession(workerMessage.session, {
      dispatchAlerts: true,
      persist: true,
      render: true,
      syncWorker: false
    });

    expectParity(localHarness.state, workerHarness.state);
  });

  it('keeps RESET_ALL parity', async () => {
    const settings = createDefaultSettings();
    const startNow = Date.now();
    const initialSession = startCurrentStep(createInitialSession(settings), startNow);
    const payload = {
      now: startNow + 2_000,
      settings
    };
    const localHarness = createControllerHarness(initialSession, settings);
    const workerHarness = createControllerHarness(initialSession, settings);

    localHarness.controller.handleLocalAction(WORKER_ACTIONS.RESET_ALL, payload);
    const workerMessage = await runWorkerAction(initialSession, WORKER_ACTIONS.RESET_ALL, payload);

    expect(workerMessage?.type).toBe(WORKER_MESSAGE_TYPES.STATE);
    workerHarness.controller.commitSession(workerMessage.session, {
      dispatchAlerts: true,
      persist: true,
      render: true,
      syncWorker: false
    });

    expectParity(localHarness.state, workerHarness.state);
  });

  it('keeps END_STEP_EARLY parity', async () => {
    const settings = createDefaultSettings();
    const startNow = Date.now();
    const initialSession = startCurrentStep(createInitialSession(settings), startNow);
    const payload = {
      now: startNow + 2_000
    };
    const localHarness = createControllerHarness(initialSession, settings);
    const workerHarness = createControllerHarness(initialSession, settings);

    localHarness.controller.handleLocalAction(WORKER_ACTIONS.END_STEP_EARLY, payload);
    const workerMessage = await runWorkerAction(
      initialSession,
      WORKER_ACTIONS.END_STEP_EARLY,
      payload
    );

    expect(workerMessage?.type).toBe(WORKER_MESSAGE_TYPES.STEP_FINISHED);
    workerHarness.controller.commitSession(workerMessage.session, {
      completionReason: workerMessage.reason,
      dispatchAlerts: true,
      persist: true,
      render: true,
      syncWorker: false
    });

    expectParity(localHarness.state, workerHarness.state);
  });

  it('keeps SET_FOCUS_TAG parity', async () => {
    const settings = createDefaultSettings();
    const initialSession = createInitialSession(settings);
    const payload = {
      focusTag: 'study',
      now: 7_000
    };
    const localHarness = createControllerHarness(initialSession, settings);
    const workerHarness = createControllerHarness(initialSession, settings);

    localHarness.controller.handleLocalAction(WORKER_ACTIONS.SET_FOCUS_TAG, payload);
    const workerMessage = await runWorkerAction(
      initialSession,
      WORKER_ACTIONS.SET_FOCUS_TAG,
      payload
    );

    expect(workerMessage?.type).toBe(WORKER_MESSAGE_TYPES.STATE);
    workerHarness.controller.commitSession(workerMessage.session, {
      dispatchAlerts: true,
      persist: true,
      render: true,
      syncWorker: false
    });

    expectParity(localHarness.state, workerHarness.state);
  });
});
