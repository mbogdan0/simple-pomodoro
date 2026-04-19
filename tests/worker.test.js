import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession } from '../src/core/session.js';

const originalSelf = globalThis.self;

async function loadWorkerWithHarness() {
  const emitted = [];
  const harness = {
    onmessage: null,
    postMessage(message) {
      emitted.push(message);
    }
  };

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
});
