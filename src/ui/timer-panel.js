export function renderTimerPanel(timerModel) {
  return `
    <section class="panel timer-panel" style="--accent:${timerModel.accent};">
      <p class="timer-mode" data-live-step-label>${timerModel.stepLabel}</p>
      <div class="timer-clock" data-live-clock>${timerModel.clock}</div>
      <p class="timer-repeat-meta" data-live-repeat-meta>
        Focus repeat ${timerModel.focusRepeatCurrent}/${timerModel.focusRepeatTotal} ·
        Step ${timerModel.stepCurrent}/${timerModel.stepTotal}
      </p>

      <div class="progress-line" aria-hidden="true">
        <span
          class="progress-line__fill"
          data-live-progress-fill
          style="width:${timerModel.progressPercent}%;"
        ></span>
      </div>

      <p class="timer-status" data-live-status>${timerModel.statusText}</p>

      <div class="action-row">
        <button class="action-button primary" data-action="${timerModel.primaryAction}" type="button">
          ${timerModel.primaryActionLabel}
        </button>
        <button class="action-button" data-action="reset-session" type="button">Reset</button>
      </div>

      ${
        timerModel.backgroundNotice
          ? `<p class="notice-banner subtle">${timerModel.backgroundNotice}</p>`
          : ''
      }
    </section>
  `;
}
