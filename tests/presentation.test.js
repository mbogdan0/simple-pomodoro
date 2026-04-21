import { describe, expect, it } from 'vitest';

import { createFaviconModel, renderFaviconDataUrl } from '../src/core/favicon.js';
import {
  formatClock,
  formatDocumentTitle,
  formatNotificationPermissionLabel,
  formatPipClock
} from '../src/core/format.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession, startCurrentStep, syncSession } from '../src/core/session.js';

describe('presentation helpers', () => {
  const settings = createDefaultSettings();

  it('formats document title using remaining time and step label', () => {
    const running = startCurrentStep(createInitialSession(settings), 10_000);
    const title = formatDocumentTitle(running, 10_000);

    expect(title).toContain('25:00');
    expect(title).toContain('Focus');
  });

  it('formats notification access labels in plain English', () => {
    expect(formatNotificationPermissionLabel('granted')).toBe('Allowed');
    expect(formatNotificationPermissionLabel('default')).toBe('Not allowed');
    expect(formatNotificationPermissionLabel('unsupported')).toBe('Unavailable');
  });

  it('keeps PiP clock format unchanged when 10-second ticking is disabled', () => {
    const remainingMs = 24 * 60 * 1000 + 59 * 1000;

    expect(
      formatPipClock({
        remainingMs,
        status: 'running',
        stepDurationMs: 25 * 60 * 1000,
        tickEvery10Seconds: false
      })
    ).toBe(formatClock(remainingMs));
  });

  it('quantizes PiP clock to the next 10-second boundary while running', () => {
    expect(
      formatPipClock({
        remainingMs: 24 * 60 * 1000 + 49 * 1000,
        status: 'running',
        stepDurationMs: 25 * 60 * 1000,
        tickEvery10Seconds: true
      })
    ).toBe('24:50');
  });

  it('shows per-second PiP clock updates for the first 10 seconds after a step starts', () => {
    expect(
      formatPipClock({
        remainingMs: 24 * 60 * 1000 + 59 * 1000,
        status: 'running',
        stepDurationMs: 25 * 60 * 1000,
        tickEvery10Seconds: true
      })
    ).toBe('24:59');
    expect(
      formatPipClock({
        remainingMs: 24 * 60 * 1000 + 51 * 1000,
        status: 'running',
        stepDurationMs: 25 * 60 * 1000,
        tickEvery10Seconds: true
      })
    ).toBe('24:51');
  });

  it('shows per-second PiP clock updates for the final 9 seconds', () => {
    expect(
      formatPipClock({
        remainingMs: 9_000,
        status: 'running',
        stepDurationMs: 25 * 60 * 1000,
        tickEvery10Seconds: true
      })
    ).toBe('00:09');
    expect(
      formatPipClock({
        remainingMs: 8_000,
        status: 'running',
        stepDurationMs: 25 * 60 * 1000,
        tickEvery10Seconds: true
      })
    ).toBe('00:08');
  });

  it('does not quantize PiP clock outside running status', () => {
    const remainingMs = 24 * 60 * 1000 + 59 * 1000;

    expect(
      formatPipClock({
        remainingMs,
        status: 'paused',
        stepDurationMs: 25 * 60 * 1000,
        tickEvery10Seconds: true
      })
    ).toBe('24:59');
    expect(
      formatPipClock({
        remainingMs,
        status: 'idle',
        stepDurationMs: 25 * 60 * 1000,
        tickEvery10Seconds: true
      })
    ).toBe('24:59');
  });

  it('describes favicon state for running, paused and completed sessions', () => {
    const running = startCurrentStep(createInitialSession(settings), 0);
    const runningModel = createFaviconModel(running, 0);
    const pausedModel = createFaviconModel(
      {
        ...running,
        endsAt: null,
        remainingMsAtPause: 60_000,
        status: 'paused'
      },
      0
    );
    const completed = syncSession(running, running.endsAt + 2_000);
    const completedModel = createFaviconModel(completed, completed.finishedAt);

    expect(runningModel.text).toBeUndefined();
    expect(pausedModel.text).toBeUndefined();
    expect(completedModel.text).toBeUndefined();
    expect(pausedModel.progress).toBeGreaterThan(runningModel.progress);
    expect(completedModel.progress).toBe(1);
  });

  it('renders a favicon data URL when a canvas-like document is provided', () => {
    const calls = [];
    const fakeDocument = {
      createElement() {
        return {
          getContext() {
            return {
              arc: (...args) => calls.push(['arc', ...args]),
              beginPath: () => calls.push(['beginPath']),
              clearRect: () => calls.push(['clearRect']),
              fill: () => calls.push(['fill']),
              fillText: (...args) => calls.push(['fillText', ...args]),
              stroke: () => calls.push(['stroke'])
            };
          },
          set height(value) {
            this._height = value;
          },
          set width(value) {
            this._width = value;
          },
          toDataURL() {
            return 'data:image/png;base64,fake';
          }
        };
      }
    };

    const url = renderFaviconDataUrl(
      {
        background: '#fff',
        progress: 0.5,
        ring: '#000'
      },
      fakeDocument
    );

    expect(url).toBe('data:image/png;base64,fake');
    expect(calls.length).toBeGreaterThan(0);
  });
});
