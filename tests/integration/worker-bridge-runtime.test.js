import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWorkerBridge } from '../../src/app/runtime/worker-bridge.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession, startCurrentStep } from '../../src/core/session.js';
import { WORKER_ACTIONS, WORKER_MESSAGE_TYPES } from '../../src/core/worker-protocol.js';

const originalWorker = globalThis.Worker;

function setWorker(value) {
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value
  });
}

function createState(overrides = {}) {
  const settings = createDefaultSettings();

  return {
    activeSession: createInitialSession(settings),
    backgroundNotice: '',
    settings,
    ...overrides
  };
}

class FakeWorker {
  constructor() {
    this.listeners = {
      error: [],
      message: []
    };
    this.postMessage = vi.fn();
    this.terminate = vi.fn();
  }

  addEventListener(type, handler) {
    this.listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    this.listeners[type] = this.listeners[type].filter((candidate) => candidate !== handler);
  }

  emit(type, payload = {}) {
    const handlers = this.listeners[type];

    handlers.forEach((handler) => {
      handler(payload);
    });
  }
}

describe('worker bridge runtime', () => {
  afterEach(() => {
    setWorker(originalWorker);
    delete globalThis.__TIMER_WORKER_SOURCE__;
    vi.restoreAllMocks();
  });

  it('falls back to local mode when Worker API is unavailable', () => {
    setWorker(undefined);
    const state = createState();
    const onWorkerMissing = vi.fn();
    const bridge = createWorkerBridge({
      handleLocalAction: vi.fn(),
      onWorkerMissing,
      onWorkerState: vi.fn(),
      onWorkerTick: vi.fn(),
      onWorkerUnavailable: vi.fn(),
      state
    });

    bridge.setupWorker();

    expect(onWorkerMissing).toHaveBeenCalledTimes(1);
    expect(state.backgroundNotice).toBe(
      'This browser may throttle timer updates in background tabs.'
    );
  });

  it('routes worker messages and switches to local mode on runtime errors', () => {
    let workerInstance = null;
    class WorkerHarness extends FakeWorker {
      constructor() {
        super();
        workerInstance = this;
      }
    }

    setWorker(WorkerHarness);
    const state = createState({
      activeSession: startCurrentStep(createInitialSession(createDefaultSettings()), 1_000)
    });
    const onIdleReminder = vi.fn();
    const onWorkerState = vi.fn();
    const onWorkerTick = vi.fn();
    const onWorkerUnavailable = vi.fn();
    const bridge = createWorkerBridge({
      handleLocalAction: vi.fn(),
      onIdleReminder,
      onWorkerMissing: vi.fn(),
      onWorkerState,
      onWorkerTick,
      onWorkerUnavailable,
      state
    });

    bridge.setupWorker();
    expect(workerInstance).toBeTruthy();
    expect(workerInstance.postMessage).toHaveBeenCalledWith({
      payload: {
        session: state.activeSession
      },
      type: WORKER_ACTIONS.INIT
    });

    workerInstance.emit('message', {
      data: {
        now: 5_000,
        type: WORKER_MESSAGE_TYPES.IDLE_REMINDER
      }
    });
    expect(onIdleReminder).toHaveBeenCalledWith(5_000);

    workerInstance.emit('message', {
      data: {
        session: {
          ...state.activeSession,
          status: 'running'
        },
        type: WORKER_MESSAGE_TYPES.TICK
      }
    });
    expect(onWorkerTick).toHaveBeenCalledTimes(1);
    expect(state.activeSession.status).toBe('running');

    workerInstance.emit('message', {
      data: {
        completionKey: 'step-1:1000',
        reason: 'sync',
        session: {
          ...state.activeSession,
          status: 'paused'
        },
        type: WORKER_MESSAGE_TYPES.STATE
      }
    });
    expect(onWorkerState).toHaveBeenCalledWith(
      expect.objectContaining({
        completionKey: 'step-1:1000',
        reason: 'sync',
        type: WORKER_MESSAGE_TYPES.STATE
      })
    );

    workerInstance.emit('message', {
      data: {
        session: state.activeSession,
        type: WORKER_MESSAGE_TYPES.ERROR
      }
    });
    expect(onWorkerUnavailable).toHaveBeenCalledTimes(1);
    expect(state.backgroundNotice).toBe('Background timer support is currently unavailable.');
    expect(workerInstance.terminate).toHaveBeenCalledTimes(1);
  });

  it('falls back to local action handling when postMessage fails', () => {
    let workerInstance = null;
    class ThrowingWorker extends FakeWorker {
      constructor() {
        super();
        workerInstance = this;
        this.postMessage = vi.fn((message) => {
          if (message.type !== WORKER_ACTIONS.INIT) {
            throw new Error('postMessage failed');
          }
        });
      }
    }

    setWorker(ThrowingWorker);
    const handleLocalAction = vi.fn();
    const bridge = createWorkerBridge({
      handleLocalAction,
      onWorkerMissing: vi.fn(),
      onWorkerState: vi.fn(),
      onWorkerTick: vi.fn(),
      onWorkerUnavailable: vi.fn(),
      state: createState()
    });

    bridge.setupWorker();
    expect(workerInstance).toBeTruthy();

    bridge.postWorkerAction(WORKER_ACTIONS.PAUSE, {
      now: 12_000
    });

    expect(workerInstance.terminate).toHaveBeenCalledTimes(1);
    expect(handleLocalAction).toHaveBeenCalledWith(WORKER_ACTIONS.PAUSE, {
      now: 12_000
    });
  });
});
