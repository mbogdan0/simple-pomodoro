function getCycleDotVisualState(dot) {
  const focusDone = dot?.focusState === 'done';
  const breakDone = dot?.breakState === 'done';
  const focusActive = dot?.focusState === 'active';
  const breakActive = dot?.breakState === 'active';
  const isActive = focusActive || breakActive;
  const activeClass = focusActive ? 'is-focus-active' : breakActive ? 'is-break-active' : '';

  if (!focusDone) {
    return {
      activeClass,
      isActive,
      stateClass: 'is-hollow'
    };
  }

  if (breakDone) {
    return {
      activeClass,
      isActive,
      stateClass: 'is-outlined'
    };
  }

  return {
    activeClass,
    isActive,
    stateClass: 'is-filled'
  };
}

function renderFocusTagsMarkup(timerModel) {
  const focusTagOptions = Array.isArray(timerModel.focusTagOptions)
    ? timerModel.focusTagOptions
    : [];
  const activeTag = timerModel.focusTag ?? 'none';

  if (!focusTagOptions.length) {
    return '';
  }

  return `
    <div class="focus-tags" aria-label="Focus tag" role="group">
      ${focusTagOptions
        .map((option) => {
          const isActive = option.id === activeTag;

          return `
            <button
              class="focus-tag-button focus-tag-button--${option.id} ${isActive ? 'is-active' : ''}"
              data-action="set-focus-tag"
              data-focus-tag="${option.id}"
              aria-pressed="${isActive ? 'true' : 'false'}"
              type="button"
            >
              ${option.label}
            </button>
          `;
        })
        .join('')}
    </div>
  `;
}

export function renderCycleProgressMarkup(cycleDots = []) {
  return cycleDots
    .map((dot, index) => {
      const visual = getCycleDotVisualState(dot);

      return `
        <span class="cycle-dot" data-cycle-dot data-repeat-index="${index}">
          <span class="cycle-dot__marker ${visual.stateClass} ${visual.isActive ? 'is-active' : ''} ${visual.activeClass}"></span>
        </span>
      `
    })
    .join('');
}

export function renderTimerPanel(timerModel) {
  const pipToggleLabel = timerModel.pipToggleLabel ?? 'Toggle PiP';
  const showPipToggle = Boolean(timerModel.showPipToggle);

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
      ${renderFocusTagsMarkup(timerModel)}
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
        <div class="action-row__left">
          <button class="action-button primary" data-action="${timerModel.primaryAction}" type="button">
            ${timerModel.primaryActionLabel}
          </button>
          <button class="action-button" data-action="reset-session" type="button">Reset</button>
        </div>
        ${
          showPipToggle
            ? `
              <div class="action-row__right">
                <button
                  class="action-button subtle action-button--pip"
                  data-action="toggle-pip-window"
                  type="button"
                >
                  ${pipToggleLabel}
                </button>
              </div>
            `
            : ''
        }
      </div>

      ${
        timerModel.backgroundNotice
          ? `<p class="notice-banner subtle">${timerModel.backgroundNotice}</p>`
          : ''
      }
    </section>
  `;
}
