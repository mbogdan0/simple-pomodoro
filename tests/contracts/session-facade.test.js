import { describe, expect, it } from 'vitest';

import {
  getCurrentStepDurationMs,
  startCurrentStep,
  createInitialSession
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
});
