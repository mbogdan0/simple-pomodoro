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
      'ADVANCE_BREAK',
      'ADVANCE_FOCUS',
      'INIT',
      'PAUSE',
      'RESET_RUN',
      'RESUME',
      'SET_FOCUS_TAG',
      'SET_IDLE_REMINDER',
      'START_STEP',
      'SYNC_NOW'
    ]);
    expect(Object.values(WORKER_MESSAGE_TYPES)).toEqual([
      'ERROR',
      'IDLE_REMINDER',
      'STATE',
      'STEP_FINISHED',
      'TICK'
    ]);

    expect(isWorkerActionType('START_STEP')).toBe(true);
    expect(isWorkerActionType('ADVANCE_FOCUS')).toBe(true);
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

  it('advances focus with explicit history metadata', async () => {
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
          focusNote: 'Prepare release notes',
          historySaveMode: 'actual',
          now: startedAt + 60_000
        },
        type: WORKER_ACTIONS.ADVANCE_FOCUS
      }
    });

    const lastMessage = emitted.at(-1);
    expect(lastMessage?.type).toBe(WORKER_MESSAGE_TYPES.STATE);
    expect(lastMessage?.reason).toBe('advance-focus');
    expect(lastMessage?.historyEntry).toMatchObject({
      durationMs: 60_000,
      focusNote: 'Prepare release notes',
      stepType: 'work'
    });
    expect(lastMessage?.session.status).toBe('running');
    expect(lastMessage?.session.currentStepIndex).toBe(1);
  });
});
