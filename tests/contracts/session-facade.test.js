import { describe, expect, it } from 'vitest';

import {
  forceCompleteCurrentStep,
  getCurrentStepDurationMs,
  createInitialSession,
  startCurrentStep
} from '../../src/core/session.js';
import { createDefaultSettings } from '../../src/core/settings.js';

describe('session facade contracts', () => {
  it('re-exports getCurrentStepDurationMs for compatibility', () => {
    const settings = createDefaultSettings();
    const session = createInitialSession(settings);
    const running = startCurrentStep(session, 1_000);

    expect(typeof getCurrentStepDurationMs).toBe('function');
    expect(getCurrentStepDurationMs(running)).toBe(settings.templateDurations.work);
  });

  it('re-exports forceCompleteCurrentStep for manual step completion flow', () => {
    const settings = createDefaultSettings();
    const session = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = forceCompleteCurrentStep(session, 2_000);

    expect(typeof forceCompleteCurrentStep).toBe('function');
    expect(completed.status).toBe('completed_waiting_next');
    expect(completed.finishedAt).toBe(2_000);
  });
});
