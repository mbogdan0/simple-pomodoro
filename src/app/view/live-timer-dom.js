import { renderCycleProgressMarkup } from '../../ui/timer-panel.js';

function formatRepeatMeta(timerModel) {
  return `Focus repeat ${timerModel.focusRepeatCurrent}/${timerModel.focusRepeatTotal} · Step ${timerModel.stepCurrent}/${timerModel.stepTotal}`;
}

export function collectLiveRefs(root) {
  return {
    clockElement: root.querySelector('[data-live-clock]'),
    cycleProgressElement: root.querySelector('[data-live-cycle-progress]'),
    focusSaveActualElement: root.querySelector('[data-live-focus-save-actual]'),
    progressBarElement: root.querySelector('[data-live-progress]'),
    progressFillElement: root.querySelector('[data-live-progress-fill]'),
    repeatMetaElement: root.querySelector('[data-live-repeat-meta]'),
    roundLabelElement: root.querySelector('[data-live-round-label]'),
    statusDetailElement: root.querySelector('[data-live-status-detail]'),
    statusElement: root.querySelector('[data-live-status]'),
    statusTextElement: root.querySelector('[data-live-status-text]'),
    stepLabelElement: root.querySelector('[data-live-step-label]')
  };
}

export function patchLiveTimerDom(refs, timerModel) {
  if (refs.clockElement) {
    refs.clockElement.textContent = timerModel.clock;
  }

  if (refs.statusTextElement) {
    refs.statusTextElement.textContent = timerModel.statusText;
  } else if (refs.statusElement) {
    refs.statusElement.textContent = timerModel.statusText;
  }

  if (refs.statusDetailElement) {
    refs.statusDetailElement.textContent = timerModel.statusDetailText;
  }

  if (refs.stepLabelElement) {
    refs.stepLabelElement.textContent = timerModel.stepLabel;
  }

  if (refs.repeatMetaElement) {
    refs.repeatMetaElement.textContent = timerModel.hideRepeatMeta
      ? ''
      : formatRepeatMeta(timerModel);
  }

  if (refs.roundLabelElement) {
    refs.roundLabelElement.textContent = timerModel.roundLabel;
  }

  if (refs.focusSaveActualElement) {
    refs.focusSaveActualElement.textContent = timerModel.focusSaveActualText;
  }

  if (refs.cycleProgressElement) {
    refs.cycleProgressElement.innerHTML = renderCycleProgressMarkup(timerModel.cycleDots);
  }

  if (refs.progressBarElement) {
    refs.progressBarElement.setAttribute('aria-valuenow', String(timerModel.progressPercent));
    refs.progressBarElement.setAttribute(
      'aria-valuetext',
      `${timerModel.progressPercent}% complete in current step`
    );
  }

  if (refs.progressFillElement) {
    refs.progressFillElement.style.width = `${timerModel.progressPercent}%`;
  }
}
