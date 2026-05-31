import { describe, expect, it, vi } from 'vitest';

import { createPageClockSync } from '../src/app/runtime/page-clock-sync.js';

describe('page clock sync', () => {
  it('updates timer live region and page chrome with the same timestamp', () => {
    const updateTimerLiveRegion = vi.fn();
    const updatePageChrome = vi.fn();
    const pageClockSync = createPageClockSync({
      updatePageChrome,
      updateTimerLiveRegion
    });

    const result = pageClockSync.syncNow(12345);

    expect(updateTimerLiveRegion).toHaveBeenCalledWith(12345);
    expect(updatePageChrome).toHaveBeenCalledWith(12345);
    expect(result).toBe(12345);
  });

  it('uses Date.now when timestamp is omitted', () => {
    const updateTimerLiveRegion = vi.fn();
    const updatePageChrome = vi.fn();
    const pageClockSync = createPageClockSync({
      updatePageChrome,
      updateTimerLiveRegion
    });
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(777);

    const result = pageClockSync.syncNow();

    expect(updateTimerLiveRegion).toHaveBeenCalledWith(777);
    expect(updatePageChrome).toHaveBeenCalledWith(777);
    expect(result).toBe(777);

    nowSpy.mockRestore();
  });
});
