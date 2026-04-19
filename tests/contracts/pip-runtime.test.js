import { describe, expect, it, vi } from 'vitest';

import { createPipSync } from '../../src/app/pip/pip-sync.js';

function createHarness(overrides = {}) {
  const state = {
    activeSession: {
      endsAt: 1_000_000,
      status: 'running'
    },
    manualPipRequested: false,
    settings: {
      pipClockTickEvery10s: false
    },
    ...overrides
  };
  const pipController = {
    close: vi.fn(),
    isOpen: vi.fn(() => false),
    isSupported: vi.fn(() => true),
    openFromUserGesture: vi.fn(async () => true),
    update: vi.fn()
  };
  const getTimerModel = vi.fn(() => ({
    accent: '#c85a3a',
    progressPercent: 50,
    progressTrack: '#ede7de',
    step: {
      durationMs: 25 * 60 * 1000
    },
    stepLabel: 'Focus'
  }));
  const renderApp = vi.fn();
  const pipSync = createPipSync({
    getTimerModel,
    pipController,
    renderApp,
    state
  });

  return {
    getTimerModel,
    pipController,
    pipSync,
    renderApp,
    state
  };
}

describe('pip runtime contracts', () => {
  it('opens and closes manual PiP window through toggle flow', async () => {
    const harness = createHarness();

    await harness.pipSync.toggleManualPipWindow();
    expect(harness.state.manualPipRequested).toBe(true);
    expect(harness.pipController.openFromUserGesture).toHaveBeenCalledTimes(1);
    expect(harness.pipController.update).toHaveBeenCalledTimes(1);

    harness.pipController.isOpen.mockReturnValue(true);
    await harness.pipSync.toggleManualPipWindow();
    expect(harness.state.manualPipRequested).toBe(false);
    expect(harness.pipController.close).toHaveBeenCalledTimes(1);
  });

  it('closes PiP when not manually requested and updates when requested', () => {
    const harness = createHarness();

    harness.pipSync.syncPictureInPicture(harness.getTimerModel(), 100_000);
    expect(harness.pipController.close).toHaveBeenCalledTimes(1);
    expect(harness.pipController.update).toHaveBeenCalledTimes(0);

    harness.state.manualPipRequested = true;
    harness.pipSync.syncPictureInPicture(harness.getTimerModel(), 120_000);
    expect(harness.pipController.update).toHaveBeenCalledTimes(1);
    expect(harness.pipController.update.mock.calls[0][0]).toMatchObject({
      status: 'running',
      stepLabel: 'Focus'
    });
  });
});
