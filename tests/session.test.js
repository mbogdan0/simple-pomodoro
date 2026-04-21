import { describe, expect, it } from 'vitest';

import { createDefaultSettings } from '../src/core/settings.js';
import {
  advanceAfterCompletion,
  canResetSession,
  createInitialSession,
  forceCompleteCurrentStep,
  getRemainingMs,
  goToNextStep,
  hasNextStep,
  normalizeSession,
  pauseSession,
  prepareSessionForStepStart,
  resetSession,
  resumeSession,
  setSessionFocusTag,
  startCurrentStep,
  syncSession
} from '../src/core/session.js';

describe('timer session engine', () => {
  const settings = createDefaultSettings();

  it('builds the scenario from repeat count and template durations', () => {
    const custom = createDefaultSettings();
    custom.repeatCount = 2;
    custom.templateDurations.work = 10 * 60 * 1000;
    custom.templateDurations.shortBreak = 3 * 60 * 1000;
    custom.templateDurations.longBreak = 12 * 60 * 1000;

    const session = createInitialSession(custom);
    const mapped = session.scenario.map((step) => step.type);

    expect(mapped).toEqual(['work', 'shortBreak', 'work', 'longBreak']);
    expect(session.scenario[0].durationMs).toBe(10 * 60 * 1000);
    expect(session.scenario[1].durationMs).toBe(3 * 60 * 1000);
    expect(session.scenario[3].durationMs).toBe(12 * 60 * 1000);
  });

  it('defaults focus tag to none', () => {
    const session = createInitialSession(settings);

    expect(session.focusTag).toBe('none');
  });

  it('starts a step using absolute timestamps', () => {
    const session = createInitialSession(settings);
    const started = startCurrentStep(session, 1_000);

    expect(started.status).toBe('running');
    expect(started.stepStartedAt).toBe(1_000);
    expect(started.endsAt).toBe(1_000 + settings.templateDurations.work);
  });

  it('ignores repeated start requests while already running', () => {
    const started = prepareSessionForStepStart(createInitialSession(settings), settings, 1_000);
    const restarted = prepareSessionForStepStart(started, settings, 5_000);

    expect(restarted.status).toBe('running');
    expect(restarted.stepStartedAt).toBe(started.stepStartedAt);
    expect(restarted.endsAt).toBe(started.endsAt);
    expect(restarted.updatedAt).toBe(started.updatedAt);
  });

  it('pauses and resumes without losing remaining time', () => {
    const session = startCurrentStep(createInitialSession(settings), 10_000);
    const paused = pauseSession(session, 70_000);
    const resumed = resumeSession(paused, 100_000);

    expect(paused.status).toBe('paused');
    expect(getRemainingMs(paused, 100_000)).toBe(settings.templateDurations.work - 60_000);
    expect(resumed.status).toBe('running');
    expect(resumed.endsAt).toBe(100_000 + settings.templateDurations.work - 60_000);
  });

  it('completes a running step early and stores remaining snapshot', () => {
    const running = startCurrentStep(createInitialSession(settings), 10_000);
    const earlyCompleted = forceCompleteCurrentStep(running, 70_000);

    expect(earlyCompleted.status).toBe('completed_waiting_next');
    expect(earlyCompleted.finishedAt).toBe(70_000);
    expect(earlyCompleted.endsAt).toBe(running.endsAt);
    expect(earlyCompleted.remainingMsAtPause).toBe(settings.templateDurations.work - 60_000);
    expect(earlyCompleted.completedInBackground).toBe(false);
  });

  it('completes a paused step early using paused remaining time', () => {
    const running = startCurrentStep(createInitialSession(settings), 10_000);
    const paused = pauseSession(running, 70_000);
    const earlyCompleted = forceCompleteCurrentStep(paused, 90_000);

    expect(earlyCompleted.status).toBe('completed_waiting_next');
    expect(earlyCompleted.finishedAt).toBe(90_000);
    expect(earlyCompleted.remainingMsAtPause).toBe(paused.remainingMsAtPause);
    expect(earlyCompleted.completedInBackground).toBe(false);
  });

  it('marks step as completed and waits for explicit start of next step', () => {
    const session = startCurrentStep(createInitialSession(settings), 1_000);
    const farFuture = session.endsAt + settings.templateDurations.shortBreak + settings.templateDurations.work;
    const completed = syncSession(session, farFuture);

    expect(completed.status).toBe('completed_waiting_next');
    expect(completed.currentStepIndex).toBe(0);
    expect(hasNextStep(completed)).toBe(true);
  });

  it('starts the next step after a completed-waiting transition', () => {
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 1_000);
    const restarted = prepareSessionForStepStart(completed, settings, completed.finishedAt + 200);

    expect(restarted.status).toBe('running');
    expect(restarted.currentStepIndex).toBe(1);
    expect(restarted.scenario[restarted.currentStepIndex].type).toBe('shortBreak');
  });

  it('keeps current cycle snapshot when settings change mid-cycle', () => {
    const initialSettings = createDefaultSettings();
    initialSettings.repeatCount = 3;
    initialSettings.templateDurations.shortBreak = 3 * 60 * 1000;

    const running = startCurrentStep(createInitialSession(initialSettings), 1_000);
    const completed = syncSession(running, running.endsAt + 1_000);
    const nextIdle = advanceAfterCompletion(completed, initialSettings, completed.finishedAt + 50);

    expect(nextIdle.status).toBe('idle');
    expect(nextIdle.currentStepIndex).toBe(1);

    const changedSettings = {
      ...initialSettings,
      repeatCount: 1,
      templateDurations: {
        ...initialSettings.templateDurations,
        shortBreak: 1 * 60 * 1000,
        work: 10 * 60 * 1000
      }
    };
    const restarted = prepareSessionForStepStart(
      nextIdle,
      changedSettings,
      completed.finishedAt + 100
    );

    expect(restarted.currentStepIndex).toBe(1);
    expect(restarted.scenario).toHaveLength(nextIdle.scenario.length);
    expect(restarted.scenario[1].durationMs).toBe(3 * 60 * 1000);
  });

  it('applies latest settings when a new cycle starts', () => {
    const initialSettings = createDefaultSettings();
    const base = createInitialSession(initialSettings);
    const runningLastStep = startCurrentStep(
      {
        ...base,
        currentStepIndex: base.scenario.length - 1
      },
      5_000
    );
    const completed = syncSession(runningLastStep, runningLastStep.endsAt + 1_000);
    const wrappedIdle = advanceAfterCompletion(completed, initialSettings, completed.finishedAt + 50);

    expect(wrappedIdle.status).toBe('idle');
    expect(wrappedIdle.currentStepIndex).toBe(0);

    const changedSettings = {
      ...initialSettings,
      repeatCount: 1,
      templateDurations: {
        ...initialSettings.templateDurations,
        work: 10 * 60 * 1000
      }
    };
    const restarted = prepareSessionForStepStart(
      wrappedIdle,
      changedSettings,
      completed.finishedAt + 100
    );

    expect(restarted.scenario).toHaveLength(2);
    expect(restarted.scenario[0].durationMs).toBe(10 * 60 * 1000);
  });

  it('does not auto-start the next step by default after completion', () => {
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 1_000);
    const next = advanceAfterCompletion(completed, settings, completed.finishedAt + 50);

    expect(next.status).toBe('idle');
    expect(next.currentStepIndex).toBe(1);
  });

  it('auto-starts the next step when setting is enabled', () => {
    const autoStartSettings = {
      ...createDefaultSettings(),
      autoStartNextStep: true
    };
    const running = startCurrentStep(createInitialSession(autoStartSettings), 1_000);
    const completed = syncSession(running, running.endsAt + 1_000);
    const next = advanceAfterCompletion(
      completed,
      autoStartSettings,
      completed.finishedAt + 50
    );

    expect(next.status).toBe('running');
    expect(next.currentStepIndex).toBe(1);
  });

  it('does not auto-start a new cycle after long break completion', () => {
    const autoStartSettings = {
      ...createDefaultSettings(),
      autoStartNextStep: true
    };
    const base = createInitialSession(autoStartSettings);
    const runningLastStep = startCurrentStep(
      {
        ...base,
        currentStepIndex: base.scenario.length - 1
      },
      5_000
    );
    const completed = syncSession(runningLastStep, runningLastStep.endsAt + 1_000);
    const next = advanceAfterCompletion(
      completed,
      autoStartSettings,
      completed.finishedAt + 100
    );

    expect(next.status).toBe('idle');
    expect(next.currentStepIndex).toBe(0);
  });

  it('moves to next step and wraps to first step at cycle end', () => {
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 2_000);
    const next = goToNextStep(completed, completed.finishedAt + 100);
    const wrapped = goToNextStep(
      {
        ...next,
        currentStepIndex: next.scenario.length - 1
      },
      completed.finishedAt + 200
    );

    expect(next.status).toBe('idle');
    expect(next.currentStepIndex).toBe(1);
    expect(wrapped.status).toBe('idle');
    expect(wrapped.currentStepIndex).toBe(0);
  });

  it('does not drift updatedAt while running step has not finished', () => {
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const synced = syncSession(running, 2_000);

    expect(synced.status).toBe('running');
    expect(synced.updatedAt).toBe(running.updatedAt);
  });

  it('resets full session to first step in idle state', () => {
    const running = startCurrentStep(createInitialSession(settings), 5_000);
    const reset = resetSession(
      {
        ...running,
        currentStepIndex: 3
      },
      9_000
    );

    expect(reset.status).toBe('idle');
    expect(reset.currentStepIndex).toBe(0);
    expect(reset.endsAt).toBeNull();
  });

  it('updates and persists focus tag through step transitions', () => {
    const initial = createInitialSession(settings);
    const tagged = setSessionFocusTag(initial, 'work', 1_500);
    const running = startCurrentStep(tagged, 2_000);
    const completed = syncSession(running, running.endsAt + 200);
    const next = advanceAfterCompletion(completed, settings, completed.finishedAt + 50);
    const reset = resetSession(next, completed.finishedAt + 100);

    expect(tagged.focusTag).toBe('work');
    expect(tagged.updatedAt).toBe(1_500);
    expect(next.focusTag).toBe('work');
    expect(reset.focusTag).toBe('work');
  });

  it('normalizes unsupported focus tags to none', () => {
    const normalized = normalizeSession(
      {
        currentStepIndex: 0,
        focusTag: 'deep',
        status: 'idle'
      },
      settings
    );

    expect(normalized.focusTag).toBe('none');
  });

  it('allows reset only when session is not at initial idle state', () => {
    const initial = createInitialSession(settings);
    const running = startCurrentStep(initial, 1_000);
    const idleOnNextStep = advanceAfterCompletion(
      syncSession(running, running.endsAt + 1_000),
      settings,
      running.endsAt + 1_050
    );

    expect(canResetSession(initial)).toBe(false);
    expect(canResetSession(running)).toBe(true);
    expect(canResetSession(idleOnNextStep)).toBe(true);
  });
});
