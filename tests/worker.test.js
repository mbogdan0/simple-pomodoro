import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession, startCurrentStep } from '../src/core/session.js';

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
  await import('../src/worker.js');

  return {
    emitted,
    harness
  };
}

describe('timer worker message handling', () => {
  afterEach(() => {
    globalThis.self = originalSelf;
  });

  it('updates focus tag through SET_FOCUS_TAG action', async () => {
    const { emitted, harness } = await loadWorkerWithHarness();
    const settings = createDefaultSettings();
    const session = createInitialSession(settings);

    harness.onmessage({
      data: {
        payload: {
          session
        },
        type: 'INIT'
      }
    });

    harness.onmessage({
      data: {
        payload: {
          focusTag: 'study',
          now: 2_500
        },
        type: 'SET_FOCUS_TAG'
      }
    });

    const lastMessage = emitted.at(-1);

    expect(lastMessage?.type).toBe('STATE');
    expect(lastMessage?.reason).toBe('set-focus-tag');
    expect(lastMessage?.session.focusTag).toBe('study');
    expect(lastMessage?.session.updatedAt).toBe(2_500);
  });

  it('emits completion message with manual_early reason for END_STEP_EARLY', async () => {
    const { emitted, harness } = await loadWorkerWithHarness();
    const settings = createDefaultSettings();
    const startedAt = Date.now();
    const session = startCurrentStep(createInitialSession(settings), startedAt);

    harness.onmessage({
      data: {
        payload: {
          session
        },
        type: 'INIT'
      }
    });

    harness.onmessage({
      data: {
        payload: {
          now: startedAt + 1_500
        },
        type: 'END_STEP_EARLY'
      }
    });

    const lastMessage = emitted.at(-1);

    expect(lastMessage?.type).toBe('STEP_FINISHED');
    expect(lastMessage?.reason).toBe('manual_early');
    expect(lastMessage?.session.status).toBe('completed_waiting_next');
    expect(lastMessage?.session.remainingMsAtPause).toBe(settings.templateDurations.work - 1_500);
  });
});
