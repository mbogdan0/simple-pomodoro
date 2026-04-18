import { describe, expect, it } from 'vitest';

import { createFaviconModel, renderFaviconDataUrl } from '../src/core/favicon.js';
import { formatDocumentTitle, formatNotificationPermissionLabel } from '../src/core/format.js';
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

    expect(runningModel.text).toBe('25');
    expect(pausedModel.text).toBe('II');
    expect(completedModel.text).toBe('✓');
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
        ring: '#000',
        text: '12',
        textColor: '#111'
      },
      fakeDocument
    );

    expect(url).toBe('data:image/png;base64,fake');
    expect(calls.length).toBeGreaterThan(0);
  });
});
