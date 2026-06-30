import { describe, expect, it } from 'vitest';

import { collectLiveRefs, patchLiveTimerDom } from '../../src/app/view/live-timer-dom.js';

function createLiveElementMap({ includeStatusText = true } = {}) {
  const attrs = {};
  const elements = {
    '[data-live-clock]': { textContent: '' },
    '[data-live-cycle-progress]': { innerHTML: '' },
    '[data-live-focus-save-actual]': { textContent: '' },
    '[data-live-progress]': {
      attrs,
      setAttribute(name, value) {
        attrs[name] = value;
      }
    },
    '[data-live-progress-fill]': { style: {} },
    '[data-live-repeat-meta]': { textContent: '' },
    '[data-live-round-label]': { textContent: '' },
    '[data-live-status]': { textContent: '' },
    '[data-live-status-detail]': { textContent: '' },
    '[data-live-step-label]': { textContent: '' }
  };

  if (includeStatusText) {
    elements['[data-live-status-text]'] = { textContent: '' };
  }

  return elements;
}

describe('live timer dom', () => {
  it('collects live refs from root selectors', () => {
    const elements = createLiveElementMap();
    const root = {
      querySelector(selector) {
        return elements[selector] ?? null;
      }
    };

    const refs = collectLiveRefs(root);

    expect(refs.clockElement).toBe(elements['[data-live-clock]']);
    expect(refs.focusSaveActualElement).toBe(elements['[data-live-focus-save-actual]']);
    expect(refs.progressFillElement).toBe(elements['[data-live-progress-fill]']);
    expect(refs.roundLabelElement).toBe(elements['[data-live-round-label]']);
    expect(refs.statusTextElement).toBe(elements['[data-live-status-text]']);
  });

  it('patches live fields and uses status fallback when status text node is missing', () => {
    const elements = createLiveElementMap({
      includeStatusText: false
    });
    const refs = {
      clockElement: elements['[data-live-clock]'],
      cycleProgressElement: elements['[data-live-cycle-progress]'],
      focusSaveActualElement: elements['[data-live-focus-save-actual]'],
      progressBarElement: elements['[data-live-progress]'],
      progressFillElement: elements['[data-live-progress-fill]'],
      repeatMetaElement: elements['[data-live-repeat-meta]'],
      roundLabelElement: elements['[data-live-round-label]'],
      statusDetailElement: elements['[data-live-status-detail]'],
      statusElement: elements['[data-live-status]'],
      statusTextElement: null,
      stepLabelElement: elements['[data-live-step-label]']
    };

    patchLiveTimerDom(refs, {
      clock: '24:59',
      cycleDots: [{ done: false, kind: 'work' }],
      focusSaveActualText: '1m 10s',
      focusRepeatCurrent: 1,
      focusRepeatTotal: 4,
      hideRepeatMeta: false,
      progressPercent: 42,
      roundLabel: 'Focus #7',
      statusDetailText: '1m 10s',
      statusText: 'Paused',
      stepCurrent: 1,
      stepLabel: 'Focus',
      stepTotal: 8
    });

    expect(elements['[data-live-clock]'].textContent).toBe('24:59');
    expect(elements['[data-live-status]'].textContent).toBe('Paused');
    expect(elements['[data-live-status-detail]'].textContent).toBe('1m 10s');
    expect(elements['[data-live-step-label]'].textContent).toBe('Focus');
    expect(elements['[data-live-repeat-meta]'].textContent).toBe('Focus repeat 1/4 · Step 1/8');
    expect(elements['[data-live-round-label]'].textContent).toBe('Focus #7');
    expect(elements['[data-live-focus-save-actual]'].textContent).toBe('1m 10s');
    expect(elements['[data-live-progress]'].attrs['aria-valuenow']).toBe('42');
    expect(elements['[data-live-progress-fill]'].style.width).toBe('42%');
  });

  it('clears repeat meta when repeat line should be hidden', () => {
    const elements = createLiveElementMap();
    const refs = collectLiveRefs({
      querySelector(selector) {
        return elements[selector] ?? null;
      }
    });

    patchLiveTimerDom(refs, {
      clock: '00:10',
      cycleDots: [],
      focusSaveActualText: '',
      focusRepeatCurrent: 0,
      focusRepeatTotal: 0,
      hideRepeatMeta: true,
      progressPercent: 5,
      statusDetailText: '',
      statusText: 'Running',
      stepCurrent: 0,
      roundLabel: '',
      stepLabel: 'Focus',
      stepTotal: 0
    });

    expect(elements['[data-live-repeat-meta]'].textContent).toBe('');
  });
});
