import { describe, expect, it, vi } from 'vitest';

import { createTimerModel } from '../../src/app/view/timer-model.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import {
  createInitialSession,
  pauseSession,
  startCurrentStep,
  syncSession
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
    lastOvertimeReminderKey: '',
    manualPipRequested: false,
    modal: null,
    notificationNotice: '',
    ntfyNotice: '',
    pauseStartedAt: null,
    serviceWorkerReady: false,
    settings,
    ...overrides
  };
}

const unsupportedPip = {
  isSupported: vi.fn(() => false)
};

describe('timer model', () => {
  it('builds running focus model with Start Break primary and Pause Timer secondary', () => {
    const settings = createDefaultSettings();
    const state = createState({
      activeSession: startCurrentStep(createInitialSession(settings), 1_000),
      settings
    });

    const timerModel = createTimerModel({
      now: 2_000,
      pipController: {
        isSupported: vi.fn(() => true)
      },
      state
    });

    expect(timerModel.statusText).toBe('Running');
    expect(timerModel.primaryAction).toBe('start-break');
    expect(timerModel.primaryActionLabel).toBe('Start Break');
    expect(timerModel.secondaryAction).toEqual({
      action: 'pause-step',
      label: 'Pause Timer'
    });
    expect(timerModel.resetDisabled).toBe(false);
    expect(timerModel.showPipToggle).toBe(true);
  });

  it('shows pause elapsed detail while keeping Start Break primary for paused focus', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const state = createState({
      activeSession: pauseSession(running, 5_000),
      pauseStartedAt: 10_000,
      settings
    });

    const timerModel = createTimerModel({
      now: 80_000,
      pipController: unsupportedPip,
      state
    });

    expect(timerModel.statusText).toBe('Paused');
    expect(timerModel.statusDetailText).toBe('1m 10s');
    expect(timerModel.primaryAction).toBe('start-break');
    expect(timerModel.secondaryAction).toEqual({
      action: 'resume-step',
      label: 'Resume Timer'
    });
  });

  it('builds overrun model for completed focus', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 1_000);
    const state = createState({
      activeSession: completed,
      settings
    });

    const timerModel = createTimerModel({
      now: completed.finishedAt + 90_000,
      pipController: unsupportedPip,
      state
    });

    expect(timerModel.clock).toBe('+01:30');
    expect(timerModel.statusText).toBe('Overtime');
    expect(timerModel.primaryAction).toBe('start-break');
    expect(timerModel.focusSaveActualText).toBe('26m 30s');
    expect(timerModel.focusSavePlannedText).toBe('25m 00s');
  });

  it('builds break model with Start Focus primary', () => {
    const settings = createDefaultSettings();
    const breakRunning = startCurrentStep(
      {
        ...createInitialSession(settings),
        currentStepIndex: 1
      },
      1_000
    );
    const state = createState({
      activeSession: breakRunning,
      settings
    });

    const timerModel = createTimerModel({
      now: 2_000,
      pipController: unsupportedPip,
      state
    });

    expect(timerModel.primaryAction).toBe('advance-break');
    expect(timerModel.primaryActionLabel).toBe('Start Focus');
  });

  it('shows infinite round labels and hides finite cycle progress', () => {
    const settings = createDefaultSettings();
    settings.infiniteCycleEnabled = true;
    const session = {
      ...createInitialSession(settings),
      roundIndex: 7
    };
    const state = createState({
      activeSession: session,
      settings
    });

    const timerModel = createTimerModel({
      now: 2_000,
      pipController: unsupportedPip,
      state
    });

    expect(timerModel.roundLabel).toBe('Focus #7');
    expect(timerModel.hideCycleProgress).toBe(true);
    expect(timerModel.hideRepeatMeta).toBe(true);
  });
});
