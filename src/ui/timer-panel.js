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

function getCycleDotTitle(dot, index) {
  const repeatNumber = index + 1;
  const focusState = dot?.focusState ?? 'pending';
  const breakState = dot?.breakState ?? 'pending';

  const focusText = focusState === 'done'
    ? 'completed'
    : focusState === 'active'
      ? 'in progress'
      : 'not completed';
  const breakText = breakState === 'done'
    ? 'completed'
    : breakState === 'active'
      ? 'in progress'
      : 'not completed';

  return `Repeat ${repeatNumber}: focus ${focusText}, break ${breakText}`;
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
      const title = getCycleDotTitle(dot, index);

      return `
        <span class="cycle-dot" data-cycle-dot data-repeat-index="${index}" title="${title}">
          <span class="cycle-dot__marker ${visual.stateClass} ${visual.isActive ? 'is-active' : ''} ${visual.activeClass}"></span>
        </span>
      `
    })
    .join('');
}

export function renderTimerPanel(timerModel) {
  const accent = timerModel.accent ?? '#c85a3a';
  const accentSoft = timerModel.accentSoft ?? '#f3e7e2';
  const accentOutline = timerModel.accentOutline ?? '#d0afa3';
  const endStepEarlyDisabled = Boolean(timerModel.endStepEarlyDisabled);
  const pipToggleLabel = timerModel.pipToggleLabel ?? 'Toggle PiP';
  const progressTrack = timerModel.progressTrack ?? '#ede7de';
  const showPipToggle = Boolean(timerModel.showPipToggle);

  return `
    <section
      class="panel timer-panel"
      id="panel-timer"
      aria-label="Timer panel"
      role="region"
      style="--accent:${accent};--accent-soft:${accentSoft};--accent-outline:${accentOutline};--progress-track:${progressTrack};"
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
          <details class="overflow-actions">
            <summary
              class="action-button subtle action-button--overflow"
              aria-label="More actions"
              title="More actions"
            >
              <span class="action-button__icon action-button__icon--kebab" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false">
                  <circle cx="8" cy="3.5" r="1.3"></circle>
                  <circle cx="8" cy="8" r="1.3"></circle>
                  <circle cx="8" cy="12.5" r="1.3"></circle>
                </svg>
              </span>
              <span class="sr-only">More actions</span>
            </summary>
            <div class="overflow-actions__menu" aria-label="Timer actions" role="menu">
              <button
                class="overflow-actions__item"
                data-action="reset-session"
                role="menuitem"
                type="button"
                ${timerModel.resetDisabled ? 'disabled aria-disabled="true"' : ''}
              >
                Reset all steps
              </button>
              <button
                class="overflow-actions__item"
                data-action="end-step-early"
                role="menuitem"
                type="button"
                ${endStepEarlyDisabled ? 'disabled aria-disabled="true"' : ''}
              >
                End step early
              </button>
            </div>
          </details>
        </div>
        <div class="action-row__right">
          ${
            showPipToggle
              ? `
                <button
                  class="action-button subtle action-button--pip"
                  data-action="toggle-pip-window"
                  type="button"
                >
                  <span class="action-button__icon action-button__icon--pip" aria-hidden="true">
                    <svg viewBox="0 0 16 16" focusable="false">
                      <rect x="2.5" y="5.5" width="8" height="8" rx="1.5"></rect>
                      <path d="M9.5 2.5h4v4"></path>
                      <path d="M13.5 2.5L8 8"></path>
                    </svg>
                  </span>
                  <span class="action-button__label">${pipToggleLabel}</span>
                </button>
              `
              : ''
          }
        </div>
      </div>

      ${
        timerModel.backgroundNotice
          ? `<p class="notice-banner subtle">${timerModel.backgroundNotice}</p>`
          : ''
      }
    </section>
  `;
}
