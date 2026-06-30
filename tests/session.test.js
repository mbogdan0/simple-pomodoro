import { describe, expect, it } from 'vitest';

import { createDefaultSettings } from '../src/core/settings.js';
import {
  advanceBreakStep,
  advanceFocusStep,
  canResetSession,
  createInitialSession,
  forceCompleteCurrentStep,
  getElapsedMs,
  getOverrunMs,
  getRemainingMs,
  goToNextStep,
  hasNextStep,
  normalizeSession,
  pauseSession,
  prepareSessionForStepStart,
  resetRun,
  resetSession,
  resumeSession,
  setSessionFocusTag,
  startCurrentStep,
  syncSession
} from '../src/core/session.js';

describe('timer session engine', () => {
  const settings = createDefaultSettings();

  it('builds finite and infinite scenarios from settings', () => {
    const finite = createDefaultSettings();
    finite.repeatCount = 2;
    finite.templateDurations.work = 10 * 60 * 1000;
    finite.templateDurations.shortBreak = 3 * 60 * 1000;
    finite.templateDurations.longBreak = 12 * 60 * 1000;

    const finiteSession = createInitialSession(finite);
    expect(finiteSession.cycleMode).toBe('finite');
    expect(finiteSession.scenario.map((step) => step.type)).toEqual([
      'work',
      'shortBreak',
      'work',
      'longBreak'
    ]);
    expect(finiteSession.scenario[0].durationMs).toBe(10 * 60 * 1000);

    const infinite = createDefaultSettings();
    infinite.infiniteCycleEnabled = true;
    const infiniteSession = createInitialSession(infinite);

    expect(infiniteSession.cycleMode).toBe('infinite');
    expect(infiniteSession.roundIndex).toBe(1);
    expect(infiniteSession.scenario.map((step) => step.type)).toEqual(['work', 'shortBreak']);
  });

  it('starts, pauses, and resumes a step without losing remaining time', () => {
    const session = startCurrentStep(createInitialSession(settings), 10_000);
    const paused = pauseSession(session, 70_000);
    const resumed = resumeSession(paused, 100_000);

    expect(session.status).toBe('running');
    expect(session.stepStartedAt).toBe(10_000);
    expect(paused.status).toBe('paused');
    expect(getRemainingMs(paused, 100_000)).toBe(settings.templateDurations.work - 60_000);
    expect(resumed.status).toBe('running');
    expect(resumed.endsAt).toBe(100_000 + settings.templateDurations.work - 60_000);
  });

  it('marks completion and keeps the current step waiting for explicit advance', () => {
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 90_000);
    const startAttempt = prepareSessionForStepStart(
      completed,
      settings,
      completed.finishedAt + 200
    );

    expect(completed.status).toBe('completed_waiting_next');
    expect(completed.currentStepIndex).toBe(0);
    expect(getOverrunMs(completed, completed.finishedAt + 90_000)).toBe(90_000);
    expect(startAttempt).toBe(completed);
  });

  it('advances focus to a running break without auto-writing history', () => {
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 30_000);
    const breakRunning = advanceFocusStep(completed, completed.finishedAt + 30_000);

    expect(breakRunning.status).toBe('running');
    expect(breakRunning.currentStepIndex).toBe(1);
    expect(breakRunning.scenario[1].type).toBe('shortBreak');
    expect(breakRunning.stepStartedAt).toBe(completed.finishedAt + 30_000);
  });

  it('advances an early focus to break and measures actual elapsed focus time', () => {
    const running = startCurrentStep(createInitialSession(settings), 10_000);
    const breakRunning = advanceFocusStep(running, 70_000);

    expect(getElapsedMs(running, 70_000)).toBe(60_000);
    expect(breakRunning.status).toBe('running');
    expect(breakRunning.currentStepIndex).toBe(1);
  });

  it('advances break early to the next focus without logging history', () => {
    const base = createInitialSession(settings);
    const runningBreak = startCurrentStep(
      {
        ...base,
        currentStepIndex: 1
      },
      1_000
    );
    const focusRunning = advanceBreakStep(runningBreak, 2_000);

    expect(focusRunning.status).toBe('running');
    expect(focusRunning.currentStepIndex).toBe(2);
    expect(focusRunning.scenario[2].type).toBe('work');
  });

  it('starts a new cycle from the final finite long break', () => {
    const base = createInitialSession(settings);
    const runningLongBreak = startCurrentStep(
      {
        ...base,
        currentStepIndex: base.scenario.length - 1
      },
      1_000
    );
    const completed = syncSession(runningLongBreak, runningLongBreak.endsAt + 1_000);
    const nextCycleFocus = advanceBreakStep(completed, completed.finishedAt + 10_000);

    expect(hasNextStep(completed)).toBe(false);
    expect(nextCycleFocus.status).toBe('running');
    expect(nextCycleFocus.currentStepIndex).toBe(0);
    expect(nextCycleFocus.roundIndex).toBe(1);
  });

  it('increments infinite round count when short break advances to focus', () => {
    const infinite = createDefaultSettings();
    infinite.infiniteCycleEnabled = true;
    const session = createInitialSession(infinite);
    const breakIdle = goToNextStep(session, 1_000);
    const focusRunning = advanceBreakStep(startCurrentStep(breakIdle, 2_000), 3_000);

    expect(breakIdle.currentStepIndex).toBe(1);
    expect(breakIdle.roundIndex).toBe(1);
    expect(focusRunning.currentStepIndex).toBe(0);
    expect(focusRunning.roundIndex).toBe(2);
    expect(hasNextStep(focusRunning)).toBe(true);
  });

  it('keeps the current cycle snapshot when settings change mid-cycle', () => {
    const initialSettings = createDefaultSettings();
    initialSettings.repeatCount = 3;
    initialSettings.templateDurations.shortBreak = 3 * 60 * 1000;

    const running = startCurrentStep(createInitialSession(initialSettings), 1_000);
    const breakRunning = advanceFocusStep(running, 2_000);
    const changedSettings = {
      ...initialSettings,
      repeatCount: 1,
      templateDurations: {
        ...initialSettings.templateDurations,
        shortBreak: 1 * 60 * 1000,
        work: 10 * 60 * 1000
      }
    };
    const restartAttempt = prepareSessionForStepStart(breakRunning, changedSettings, 3_000);

    expect(restartAttempt).toBe(breakRunning);
    expect(breakRunning.scenario).toHaveLength(6);
    expect(breakRunning.scenario[1].durationMs).toBe(3 * 60 * 1000);
  });

  it('applies latest settings after reset run', () => {
    const initialSettings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(initialSettings), 1_000);
    const changedSettings = {
      ...initialSettings,
      repeatCount: 1,
      templateDurations: {
        ...initialSettings.templateDurations,
        work: 10 * 60 * 1000
      }
    };
    const reset = resetRun(running, changedSettings, 2_000);
    const restarted = prepareSessionForStepStart(reset, changedSettings, 3_000);

    expect(reset.status).toBe('idle');
    expect(reset.currentStepIndex).toBe(0);
    expect(restarted.scenario).toHaveLength(2);
    expect(restarted.scenario[0].durationMs).toBe(10 * 60 * 1000);
  });

  it('completes a running or paused step early with a remaining snapshot', () => {
    const running = startCurrentStep(createInitialSession(settings), 10_000);
    const earlyCompleted = forceCompleteCurrentStep(running, 70_000);
    const paused = pauseSession(running, 70_000);
    const pausedCompleted = forceCompleteCurrentStep(paused, 90_000);

    expect(earlyCompleted.status).toBe('completed_waiting_next');
    expect(earlyCompleted.finishedAt).toBe(70_000);
    expect(earlyCompleted.remainingMsAtPause).toBe(settings.templateDurations.work - 60_000);
    expect(pausedCompleted.remainingMsAtPause).toBe(paused.remainingMsAtPause);
  });

  it('updates and persists focus tag through step transitions and reset', () => {
    const initial = createInitialSession(settings);
    const tagged = setSessionFocusTag(initial, 'work', 1_500);
    const running = startCurrentStep(tagged, 2_000);
    const next = advanceFocusStep(running, 3_000);
    const reset = resetSession(next, 4_000);

    expect(tagged.focusTag).toBe('work');
    expect(next.focusTag).toBe('work');
    expect(reset.focusTag).toBe('work');
  });

  it('normalizes unsupported focus tags and cycle modes', () => {
    const normalized = normalizeSession(
      {
        cycleMode: 'forever',
        currentStepIndex: 0,
        focusTag: 'deep',
        roundIndex: -10,
        status: 'idle'
      },
      settings
    );

    expect(normalized.cycleMode).toBe('finite');
    expect(normalized.focusTag).toBe('none');
    expect(normalized.roundIndex).toBe(1);
  });

  it('allows reset only when the run is not at the initial idle state', () => {
    const initial = createInitialSession(settings);
    const running = startCurrentStep(initial, 1_000);
    const idleOnNextStep = goToNextStep(running, 2_000);
    const laterInfiniteIdle = {
      ...initial,
      cycleMode: 'infinite',
      roundIndex: 3
    };

    expect(canResetSession(initial)).toBe(false);
    expect(canResetSession(running)).toBe(true);
    expect(canResetSession(idleOnNextStep)).toBe(true);
    expect(canResetSession(laterInfiniteIdle)).toBe(true);
  });
});
