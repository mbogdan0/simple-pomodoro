import { describe, expect, it } from 'vitest';

import { renderTimerPanel } from '../src/ui/timer-panel.js';

describe('simple timer panel', () => {
  it('renders a minimal timer UI with repeat and step counters', () => {
    const html = renderTimerPanel({
      accent: '#c85a3a',
      backgroundNotice: '',
      clock: '25:00',
      focusRepeatCurrent: 1,
      focusRepeatTotal: 4,
      primaryAction: 'start-step',
      primaryActionLabel: 'Start',
      progressPercent: 30,
      statusText: 'Ready',
      stepCurrent: 1,
      stepLabel: 'Focus',
      stepTotal: 8
    });

    expect(html).toContain('25:00');
    expect(html).toContain('Focus repeat 1/4');
    expect(html).toContain('Step 1/8');
    expect(html).toContain('Start');
    expect(html).toContain('Reset');
    expect(html).not.toContain('Worker');
    expect(html).not.toContain('localStorage');
    expect(html).not.toContain('inline blob');
    expect(html).not.toContain('timer-worker.js');
    expect(html).not.toContain('permission');
  });
});
