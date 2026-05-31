import { describe, expect, it, vi } from 'vitest';

import { createTimerModel } from '../../src/app/view/timer-model.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import {
  createInitialSession,
  pauseSession,
  startCurrentStep,
  startFreeTimer
} from '../../src/core/session.js';

function createState(overrides = {}) {
  const settings = createDefaultSettings();

  return {
    activeSession: createInitialSession(settings),
    backgroundNotice: '',
    focusHistory: [],
    focusNoteDraft: '',
    idleStartedAt: null,
    isNtfyTesting: false,
    lastCompletionKey: '',
    lastFocusMinuteReminderKey: '',
    lastFreeTimerReminderKey: '',
    manualPipRequested: false,
    notificationNotice: '',
    ntfyNotice: '',
    pauseStartedAt: null,
    serviceWorkerReady: false,
    settings,
    ...overrides
  };
}

describe('timer model', () => {
  it('builds running cycle model with pause primary action', () => {
    const settings = createDefaultSettings();
    const state = createState({
      activeSession: startCurrentStep(createInitialSession(settings), 1_000),
      settings
    });
    const pipController = {
      isSupported: vi.fn(() => true)
    };

    const timerModel = createTimerModel({
      now: 2_000,
      pipController,
      state
    });

    expect(timerModel.statusText).toBe('Running');
    expect(timerModel.primaryAction).toBe('pause-step');
    expect(timerModel.primaryActionLabel).toBe('Pause');
    expect(timerModel.showStartFreeTimer).toBe(false);
    expect(timerModel.resetDisabled).toBe(false);
    expect(timerModel.showPipToggle).toBe(true);
  });

  it('shows pause elapsed detail for paused sessions', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const state = createState({
      activeSession: pauseSession(running, 5_000),
      pauseStartedAt: 10_000,
      settings
    });

    const timerModel = createTimerModel({
      now: 80_000,
      pipController: {
        isSupported: vi.fn(() => false)
      },
      state
    });

    expect(timerModel.statusText).toBe('Paused');
    expect(timerModel.statusDetailText).toBe('1m 10s');
    expect(timerModel.primaryAction).toBe('resume-step');
    expect(timerModel.primaryActionLabel).toBe('Resume');
  });

  it('builds free timer model with free-only actions', () => {
    const settings = createDefaultSettings();
    const state = createState({
      activeSession: startFreeTimer(createInitialSession(settings), settings, 1_000),
      settings
    });

    const timerModel = createTimerModel({
      now: 20_000,
      pipController: {
        isSupported: vi.fn(() => true)
      },
      state
    });

    expect(timerModel.stepLabel).toBe('Free Timer');
    expect(timerModel.hideCycleProgress).toBe(true);
    expect(timerModel.hideRepeatMeta).toBe(true);
    expect(timerModel.showFinishFreeTimer).toBe(true);
    expect(timerModel.showDiscardFreeTimer).toBe(true);
    expect(timerModel.endStepEarlyDisabled).toBe(true);
  });
});
