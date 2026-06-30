import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSessionController } from '../../src/app/session/session-controller.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession, pauseSession, startCurrentStep } from '../../src/core/session.js';
import { WORKER_ACTIONS } from '../../src/core/worker-protocol.js';

const originalSelf = globalThis.self;

function createControllerHarness(initialSession, settings) {
  const state = {
    activeSession: initialSession,
    focusHistory: [],
    focusNoteDraft: '',
    idleStartedAt: null,
    lastCompletionKey: '',
    lastOvertimeReminderKey: '',
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
      type: WORKER_ACTIONS.RESET_RUN
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

async function expectActionParity(initialSession, type, payload, expectedMessageType = 'STATE') {
  const settings = payload.settings ?? createDefaultSettings();
  const localHarness = createControllerHarness(initialSession, settings);
  const workerHarness = createControllerHarness(initialSession, settings);

  localHarness.controller.handleLocalAction(type, payload);
  const workerMessage = await runWorkerAction(initialSession, type, payload);

  expect(workerMessage?.type).toBe(expectedMessageType);
  workerHarness.controller.commitSession(workerMessage.session, {
    completionKeyHint: workerMessage.completionKey,
    dispatchAlerts: true,
    historyEntryHint: workerMessage.historyEntry,
    persist: true,
    render: true,
    syncWorker: false
  });

  expectParity(localHarness.state, workerHarness.state);
  return {
    localHarness,
    workerMessage
  };
}

describe('session action parity between local fallback and worker path', () => {
  afterEach(() => {
    globalThis.self = originalSelf;
    vi.restoreAllMocks();
  });

  it('keeps START_STEP parity', async () => {
    const settings = createDefaultSettings();
    await expectActionParity(createInitialSession(settings), WORKER_ACTIONS.START_STEP, {
      now: 2_000,
      settings
    });
  });

  it('keeps PAUSE and RESUME parity', async () => {
    const settings = createDefaultSettings();
    const startNow = Date.now();
    const running = startCurrentStep(createInitialSession(settings), startNow);
    const paused = pauseSession(running, startNow + 1_000);

    await expectActionParity(running, WORKER_ACTIONS.PAUSE, {
      now: startNow + 2_000,
      settings
    });
    await expectActionParity(paused, WORKER_ACTIONS.RESUME, {
      now: startNow + 2_000,
      settings
    });
  });

  it('keeps RESET_RUN parity', async () => {
    const settings = createDefaultSettings();
    const startNow = Date.now();
    const running = startCurrentStep(createInitialSession(settings), startNow);

    await expectActionParity(running, WORKER_ACTIONS.RESET_RUN, {
      now: startNow + 2_000,
      settings
    });
  });

  it('keeps ADVANCE_FOCUS parity with history metadata', async () => {
    const settings = createDefaultSettings();
    const startNow = Date.now();
    const running = startCurrentStep(createInitialSession(settings), startNow);
    const { localHarness } = await expectActionParity(running, WORKER_ACTIONS.ADVANCE_FOCUS, {
      focusNote: 'Prepare release notes',
      historySaveMode: 'actual',
      now: startNow + 60_000,
      settings
    });

    expect(localHarness.state.focusHistory).toHaveLength(1);
    expect(localHarness.state.focusHistory[0]).toMatchObject({
      durationMs: 60_000,
      focusNote: 'Prepare release notes',
      stepType: 'work'
    });
  });

  it('keeps ADVANCE_BREAK parity without history metadata', async () => {
    const settings = createDefaultSettings();
    const startNow = Date.now();
    const breakRunning = startCurrentStep(
      {
        ...createInitialSession(settings),
        currentStepIndex: 1
      },
      startNow
    );
    const { localHarness, workerMessage } = await expectActionParity(
      breakRunning,
      WORKER_ACTIONS.ADVANCE_BREAK,
      {
        now: startNow + 1_000,
        settings
      }
    );

    expect(workerMessage?.historyEntry).toBe(null);
    expect(localHarness.state.focusHistory).toHaveLength(0);
    expect(localHarness.state.activeSession.currentStepIndex).toBe(2);
  });

  it('keeps SET_FOCUS_TAG parity', async () => {
    const settings = createDefaultSettings();
    await expectActionParity(createInitialSession(settings), WORKER_ACTIONS.SET_FOCUS_TAG, {
      focusTag: 'study',
      now: 7_000,
      settings
    });
  });
});
