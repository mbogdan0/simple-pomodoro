const DOT_STATE_CLASSES = {
  active: 'is-active',
  done: 'is-done',
  pending: 'is-pending'
};

function getDotStateClass(state) {
  return DOT_STATE_CLASSES[state] ?? DOT_STATE_CLASSES.pending;
}

export function renderCycleProgressMarkup(cycleDots = []) {
  return cycleDots
    .map(
      (dot, index) => `
        <span class="cycle-dot" data-cycle-dot data-repeat-index="${index}">
          <span
            class="cycle-dot__outer ${getDotStateClass(dot.focusState)}"
            data-cycle-focus
          ></span>
          <span
            class="cycle-dot__inner ${getDotStateClass(dot.breakState)}"
            data-cycle-break
          ></span>
        </span>
      `
    )
    .join('');
}

export function renderTimerPanel(timerModel) {
  return `
    <section
      class="panel timer-panel"
      id="panel-timer"
      aria-label="Timer panel"
      role="region"
      style="--accent:${timerModel.accent};"
    >
      <p class="timer-mode" data-live-step-label>${timerModel.stepLabel}</p>
      <div
        class="timer-clock"
        data-live-clock
        aria-label="Time remaining"
        aria-live="off"
        role="timer"
      >
        ${timerModel.clock}
      </div>
      <div class="cycle-progress" data-live-cycle-progress aria-hidden="true">
        ${renderCycleProgressMarkup(timerModel.cycleDots)}
      </div>
      <p class="timer-repeat-meta sr-only" data-live-repeat-meta>
        Focus repeat ${timerModel.focusRepeatCurrent}/${timerModel.focusRepeatTotal} ·
        Step ${timerModel.stepCurrent}/${timerModel.stepTotal}
      </p>

      <div
        class="progress-line"
        data-live-progress
        aria-label="Current step progress"
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow="${timerModel.progressPercent}"
        aria-valuetext="${timerModel.progressPercent}% complete in current step"
        role="progressbar"
      >
        <span
          class="progress-line__fill"
          data-live-progress-fill
          style="width:${timerModel.progressPercent}%;"
        ></span>
      </div>

      <p
        class="timer-status"
        data-live-status
        aria-atomic="true"
        aria-live="polite"
        role="status"
      >
        ${timerModel.statusText}
      </p>

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
