import { describe, expect, it, vi } from 'vitest';

import { createSafetyLoop } from '../src/app/runtime/safety-loop.js';

describe('safety loop', () => {
  it('starts at most one interval and stops idempotently', () => {
    const clearIntervalFn = vi.fn();
    const onTick = vi.fn();
    const setIntervalFn = vi.fn(() => 42);
    const loop = createSafetyLoop({
      clearIntervalFn,
      intervalMs: 750,
      onTick,
      setIntervalFn
    });

    loop.start();
    loop.start();

    expect(setIntervalFn).toHaveBeenCalledTimes(1);
    expect(setIntervalFn).toHaveBeenCalledWith(onTick, 750);

    loop.stop();
    loop.stop();

    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
    expect(clearIntervalFn).toHaveBeenCalledWith(42);
  });
});
