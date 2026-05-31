import { describe, expect, it, vi } from 'vitest';

import { createWorkerCommandBus } from '../src/app/runtime/worker-command-bus.js';

describe('worker command bus', () => {
  it('stays safe before worker bridge is bound', () => {
    const bus = createWorkerCommandBus();

    expect(() => {
      bus.postWorkerAction('start-step', {
        settings: {}
      });
      bus.syncWorkerState();
    }).not.toThrow();
  });

  it('delegates commands after worker bridge binding', () => {
    const postWorkerAction = vi.fn();
    const syncWorkerState = vi.fn();
    const bus = createWorkerCommandBus();

    bus.bindWorkerBridge({
      postWorkerAction,
      syncWorkerState
    });
    bus.postWorkerAction('pause-step', {
      reason: 'test'
    });
    bus.syncWorkerState();

    expect(postWorkerAction).toHaveBeenCalledWith('pause-step', {
      reason: 'test'
    });
    expect(syncWorkerState).toHaveBeenCalledTimes(1);
  });
});
