import { describe, expect, it } from 'vitest';

import { createDefaultSettings } from '../src/core/settings.js';
import {
  createInitialSession,
  getRemainingMs,
  goToNextStep,
  hasNextStep,
  pauseSession,
  prepareSessionForStepStart,
  resetSession,
  resumeSession,
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

  it('starts a step using absolute timestamps', () => {
    const session = createInitialSession(settings);
    const started = startCurrentStep(session, 1_000);

    expect(started.status).toBe('running');
    expect(started.stepStartedAt).toBe(1_000);
    expect(started.endsAt).toBe(1_000 + settings.templateDurations.work);
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
});
