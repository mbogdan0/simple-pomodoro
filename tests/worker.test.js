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

  it('emits a passive completion message at the planned end time', async () => {
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
          now: session.endsAt + 1_500
        },
        type: 'SYNC_NOW'
      }
    });

    const lastMessage = emitted.at(-1);

    expect(lastMessage?.type).toBe('STEP_FINISHED');
    expect(lastMessage?.reason).toBe('completed');
    expect(lastMessage?.session.status).toBe('completed_waiting_next');
    expect(lastMessage?.session.remainingMsAtPause).toBe(0);
  });

  it('handles ADVANCE_FOCUS and ADVANCE_BREAK actions', async () => {
    const { emitted, harness } = await loadWorkerWithHarness();
    const settings = createDefaultSettings();
    const session = startCurrentStep(createInitialSession(settings), 2_000);

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
          focusNote: 'Prepare release notes',
          historySaveMode: 'actual',
          now: 62_000,
          settings
        },
        type: 'ADVANCE_FOCUS'
      }
    });

    const breakMessage = emitted.at(-1);
    expect(breakMessage?.type).toBe('STATE');
    expect(breakMessage?.reason).toBe('advance-focus');
    expect(breakMessage?.historyEntry).toMatchObject({
      durationMs: 60_000,
      focusNote: 'Prepare release notes',
      stepType: 'work'
    });
    expect(breakMessage?.session.status).toBe('running');
    expect(breakMessage?.session.currentStepIndex).toBe(1);

    harness.onmessage({
      data: {
        payload: {
          now: 63_000,
          settings
        },
        type: 'ADVANCE_BREAK'
      }
    });

    const focusMessage = emitted.at(-1);
    expect(focusMessage?.type).toBe('STATE');
    expect(focusMessage?.reason).toBe('advance-break');
    expect(focusMessage?.historyEntry).toBe(null);
    expect(focusMessage?.session.currentStepIndex).toBe(2);
  });
});
