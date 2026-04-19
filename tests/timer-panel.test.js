import { describe, expect, it } from 'vitest';

import { renderTimerPanel } from '../src/ui/timer-panel.js';

describe('simple timer panel', () => {
  it('renders timer UI with single-circle cycle dots, tags and accessible repeat metadata', () => {
    const html = renderTimerPanel({
      accent: '#c85a3a',
      backgroundNotice: '',
      cycleDots: [
        { breakState: 'pending', focusState: 'active', id: 'focus-1' },
        { breakState: 'done', focusState: 'done', id: 'focus-2' }
      ],
      clock: '25:00',
      focusTag: 'work',
      focusTagOptions: [
        { id: 'none', label: 'No tag' },
        { id: 'work', label: 'Work' },
        { id: 'study', label: 'Study' }
      ],
      focusRepeatCurrent: 1,
      focusRepeatTotal: 4,
      pipToggleLabel: 'Toggle PiP',
      showPipToggle: true,
      primaryAction: 'start-step',
      primaryActionLabel: 'Start',
      progressPercent: 30,
      statusText: 'Ready',
      stepCurrent: 1,
      stepLabel: 'Focus',
      stepTotal: 8
    });

    expect(html).toContain('25:00');
    expect(html).toContain('data-live-cycle-progress');
    expect(html).toContain('role="timer"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="30"');
    expect(html).toContain('role="status"');
    expect(html).toContain('cycle-dot__marker is-hollow is-active is-focus-active');
    expect(html).toContain('cycle-dot__marker is-outlined');
    expect(html).toContain('data-action="set-focus-tag"');
    expect(html).toContain('data-focus-tag="none"');
    expect(html).toContain('data-focus-tag="work"');
    expect(html).toContain('data-focus-tag="study"');
    expect(html).toContain('focus-tag-button--work is-active');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Focus repeat 1/4');
    expect(html).toContain('Step 1/8');
    expect(html).toContain('Start');
    expect(html).toContain('Reset');
    expect(html).toContain('Toggle PiP');
    expect(html).toContain('data-action="toggle-pip-window"');
    expect(html).toContain('action-row__left');
    expect(html).toContain('action-row__right');
    expect(html).toContain('action-button subtle action-button--pip');
    expect(html).not.toContain('Worker');
    expect(html).not.toContain('localStorage');
    expect(html).not.toContain('inline blob');
    expect(html).not.toContain('timer-worker.js');
    expect(html).not.toContain('permission');
  });

  it('does not render PiP control when PiP is unsupported', () => {
    const html = renderTimerPanel({
      accent: '#c85a3a',
      backgroundNotice: '',
      cycleDots: [],
      clock: '25:00',
      focusTag: 'none',
      focusTagOptions: [
        { id: 'none', label: 'No tag' },
        { id: 'work', label: 'Work' },
        { id: 'study', label: 'Study' }
      ],
      focusRepeatCurrent: 1,
      focusRepeatTotal: 4,
      pipToggleLabel: 'Toggle PiP',
      showPipToggle: false,
      primaryAction: 'start-step',
      primaryActionLabel: 'Start',
      progressPercent: 0,
      statusText: 'Ready',
      stepCurrent: 1,
      stepLabel: 'Focus',
      stepTotal: 8
    });

    expect(html).not.toContain('Toggle PiP');
    expect(html).not.toContain('data-action="toggle-pip-window"');
    expect(html).toContain('No tag');
  });
});
