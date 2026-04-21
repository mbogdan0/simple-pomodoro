import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultSettings } from '../../src/core/settings.js';
import { createInitialSession, startCurrentStep } from '../../src/core/session.js';
import {
  WORKER_ACTIONS,
  WORKER_MESSAGE_TYPES,
  isWorkerActionType,
  isWorkerMessageType
} from '../../src/core/worker-protocol.js';

const originalSelf = globalThis.self;

async function loadWorkerWithHarness() {
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

  return {
    emitted,
    harness
  };
}

describe('worker protocol contracts', () => {
  afterEach(() => {
    globalThis.self = originalSelf;
  });

  it('declares a strict set of known action and message types', () => {
    expect(Object.values(WORKER_ACTIONS)).toEqual([
      'INIT',
      'END_STEP_EARLY',
      'PAUSE',
      'RESET_ALL',
      'RESUME',
      'SET_FOCUS_TAG',
      'START_STEP',
      'SYNC_NOW'
    ]);
    expect(Object.values(WORKER_MESSAGE_TYPES)).toEqual([
      'ERROR',
      'STATE',
      'STEP_FINISHED',
      'TICK'
    ]);

    expect(isWorkerActionType('START_STEP')).toBe(true);
    expect(isWorkerActionType('END_STEP_EARLY')).toBe(true);
    expect(isWorkerActionType('START')).toBe(false);
    expect(isWorkerMessageType('STEP_FINISHED')).toBe(true);
    expect(isWorkerMessageType('DONE')).toBe(false);
  });

  it('is consumed by worker runtime for action dispatch', async () => {
    const { emitted, harness } = await loadWorkerWithHarness();

    harness.onmessage({
      data: {
        payload: {
          session: {
            currentStepIndex: 0,
            status: 'idle'
          }
        },
        type: WORKER_ACTIONS.INIT
      }
    });

    harness.onmessage({
      data: {
        payload: {
          focusTag: 'study',
          now: 2_000
        },
        type: WORKER_ACTIONS.SET_FOCUS_TAG
      }
    });

    const lastMessage = emitted.at(-1);
    expect(lastMessage?.type).toBe(WORKER_MESSAGE_TYPES.STATE);
    expect(lastMessage?.reason).toBe('set-focus-tag');
    expect(lastMessage?.session.focusTag).toBe('study');
  });

  it('emits manual_early completion for END_STEP_EARLY action', async () => {
    const { emitted, harness } = await loadWorkerWithHarness();
    const startedAt = Date.now();
    const session = startCurrentStep(createInitialSession(createDefaultSettings()), startedAt);

    harness.onmessage({
      data: {
        payload: {
          session
        },
        type: WORKER_ACTIONS.INIT
      }
    });

    harness.onmessage({
      data: {
        payload: {
          now: startedAt + 1_000
        },
        type: WORKER_ACTIONS.END_STEP_EARLY
      }
    });

    const lastMessage = emitted.at(-1);
    expect(lastMessage?.type).toBe(WORKER_MESSAGE_TYPES.STEP_FINISHED);
    expect(lastMessage?.reason).toBe('manual_early');
    expect(lastMessage?.completionKey).toBeTypeOf('string');
    expect(lastMessage?.session.status).toBe('completed_waiting_next');
  });
});
