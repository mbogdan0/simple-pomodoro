import { describe, expect, it } from 'vitest';

import { renderTimerPanel } from '../src/ui/timer-panel.js';

function createTimerModel(overrides = {}) {
  return {
    accent: '#c85a3a',
    accentOutline: '#d0afa3',
    accentSoft: '#f3e7e2',
    backgroundNotice: '',
    clock: '25:00',
    cycleDots: [
      { breakState: 'pending', focusState: 'active', id: 'focus-1' },
      { breakState: 'done', focusState: 'done', id: 'focus-2' }
    ],
    endStepEarlyDisabled: false,
    focusTag: 'work',
    focusTagOptions: [
      { id: 'none', label: 'No tag' },
      { id: 'work', label: 'Work' },
      { id: 'study', label: 'Study' }
    ],
    focusRepeatCurrent: 1,
    focusRepeatTotal: 4,
    pipToggleLabel: 'Toggle PiP',
    primaryAction: 'start-step',
    primaryActionLabel: 'Start',
    progressPercent: 30,
    progressTrack: '#ede7de',
    resetDisabled: false,
    showPipToggle: true,
    statusText: 'Ready',
    stepCurrent: 1,
    stepLabel: 'Focus',
    stepTotal: 8,
    ...overrides
  };
}

describe('timer panel behavior', () => {
  it('reflects action and accessibility model values in rendered output', () => {
    const html = renderTimerPanel(createTimerModel());

    expect(html).toContain('data-action="start-step"');
    expect(html).toContain('aria-valuenow="30"');
    expect(html).toContain('aria-valuetext="30% complete in current step"');
    expect(html).toContain('data-action="set-focus-tag"');
    expect(html).toContain('focus-tag-button--work is-active');
    expect(html).toContain('class="overflow-actions"');
    expect(html).toContain('data-action="end-step-early"');
    expect(html).toContain('role="timer"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('role="status"');
  });

  it('hides PiP control when feature is unavailable in model', () => {
    const html = renderTimerPanel(createTimerModel({ showPipToggle: false }));

    expect(html).not.toContain('data-action="toggle-pip-window"');
    expect(html).toContain('data-action="reset-session"');
  });

  it('disables reset action when no reset is available', () => {
    const html = renderTimerPanel(createTimerModel({ resetDisabled: true }));

    expect(html).toMatch(/data-action="reset-session"[^>]*disabled/);
  });

  it('disables end-step-early action when model marks it unavailable', () => {
    const html = renderTimerPanel(createTimerModel({ endStepEarlyDisabled: true }));

    expect(html).toMatch(/data-action="end-step-early"[^>]*disabled/);
  });
});
