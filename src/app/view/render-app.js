import {
  APP_NAME,
  FOCUS_TAG_LABELS,
  FOCUS_TAGS,
  PROGRESS_TRACK_COLOR,
  STEP_PALETTE,
  TAB_LABELS
} from '../../core/constants.js';
import { createFaviconModel, renderFaviconDataUrl } from '../../core/favicon.js';
import {
  formatClock,
  formatDocumentTitle,
  formatNotificationPermissionLabel,
  formatStepTypeLabel,
  formatStatusLabel
} from '../../core/format.js';
import { getCycleRepeatDots, getFocusRepeatProgress, getStepProgress } from '../../core/progress.js';
import { canResetSession, getCurrentStep, getProgressRatio, getRemainingMs } from '../../core/session.js';
import { renderHistoryPanel } from '../../ui/history-panel.js';
import { renderSettingsPanel } from '../../ui/settings-panel.js';
import { renderCycleProgressMarkup, renderTimerPanel } from '../../ui/timer-panel.js';

function ensureFaviconLink() {
  let link = document.querySelector('link[rel="icon"]');

  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.append(link);
  }

  return link;
}

function formatRepeatMeta(timerModel) {
  return `Focus repeat ${timerModel.focusRepeatCurrent}/${timerModel.focusRepeatTotal} · Step ${timerModel.stepCurrent}/${timerModel.stepTotal}`;
}

export function createAppRenderer({
  root,
  state,
  pipController,
  getNotificationSupportModel
}) {
  const faviconLink = ensureFaviconLink();
  let chromeSignature = '';
  let liveUpdateHooks = {
    maybeDispatchFocusMinuteReminder: () => {},
    syncPictureInPicture: () => {}
  };

  function getTimerModel(now = Date.now()) {
    const session = state.activeSession;
    const step = getCurrentStep(session);
    const stepType = step?.type ?? 'work';
    const palette = STEP_PALETTE[stepType] ?? STEP_PALETTE.work;
    const running = session.status === 'running';
    const paused = session.status === 'paused';
    const pipSupported = pipController.isSupported();
    const remainingMs = getRemainingMs(session, now);
    const progress = getProgressRatio(session, now);
    const { focusRepeatCurrent, focusRepeatTotal } = getFocusRepeatProgress(session);
    const { stepCurrent, stepTotal } = getStepProgress(session);

    return {
      accent: palette.accent,
      accentOutline: palette.accentOutline,
      accentSoft: palette.accentSoft,
      backgroundNotice: state.backgroundNotice,
      clock: formatClock(remainingMs),
      cycleDots: getCycleRepeatDots(session),
      focusTag: session.focusTag,
      focusTagOptions: FOCUS_TAGS.map((tag) => ({
        id: tag,
        label: FOCUS_TAG_LABELS[tag]
      })),
      focusRepeatCurrent,
      focusRepeatTotal,
      pipToggleLabel: 'Toggle PiP',
      showPipToggle: pipSupported,
      primaryAction: running ? 'pause-step' : paused ? 'resume-step' : 'start-step',
      primaryActionLabel: running ? 'Pause' : paused ? 'Resume' : 'Start',
      progressTrack: PROGRESS_TRACK_COLOR,
      progressPercent: Math.round(progress * 100),
      resetDisabled: !canResetSession(session),
      statusText: formatStatusLabel(session.status),
      step,
      stepCurrent,
      stepLabel: formatStepTypeLabel(step?.type),
      stepTotal
    };
  }

  function renderApp() {
    const activeTab = state.settings.lastOpenTab;
    const timerModel = getTimerModel();
    const notificationSupport = getNotificationSupportModel();
    const permissionLabel = formatNotificationPermissionLabel(notificationSupport.permissionState);

    root.innerHTML = `
      <main class="shell">
        <header class="app-header">
          <nav class="tabs" aria-label="Application navigation">
            ${Object.entries(TAB_LABELS)
              .map(
                ([tab, label]) => `
                  <button
                    class="tab-button ${activeTab === tab ? 'is-active' : ''}"
                    data-action="switch-tab"
                    data-tab="${tab}"
                    aria-current="${activeTab === tab ? 'page' : 'false'}"
                    aria-pressed="${activeTab === tab ? 'true' : 'false'}"
                    type="button"
                  >
                    ${label}
                  </button>
                `
              )
              .join('')}
          </nav>
        </header>

        <section class="panel-grid">
          ${activeTab === 'timer' ? renderTimerPanel(timerModel) : ''}
          ${
            activeTab === 'settings'
              ? renderSettingsPanel({
                  isNtfyTesting: state.isNtfyTesting,
                  notificationNotice: state.notificationNotice,
                  notificationPermissionLabel: permissionLabel,
                  notificationSupport,
                  ntfyNotice: state.ntfyNotice,
                  pipSupported: pipController.isSupported(),
                  sessionStatus: state.activeSession.status,
                  settings: state.settings
                })
              : ''
          }
          ${activeTab === 'history' ? renderHistoryPanel(state.focusHistory) : ''}
        </section>
      </main>
    `;

    updateTimerLiveRegion();
    updatePageChrome();
  }

  function updateTimerLiveRegion(now = Date.now()) {
    const timerModel = getTimerModel(now);
    const clockElement = root.querySelector('[data-live-clock]');
    const cycleProgressElement = root.querySelector('[data-live-cycle-progress]');
    const progressBarElement = root.querySelector('[data-live-progress]');
    const statusElement = root.querySelector('[data-live-status]');
    const stepLabelElement = root.querySelector('[data-live-step-label]');
    const repeatMetaElement = root.querySelector('[data-live-repeat-meta]');
    const progressFillElement = root.querySelector('[data-live-progress-fill]');

    if (clockElement) {
      clockElement.textContent = timerModel.clock;
    }

    if (statusElement) {
      statusElement.textContent = timerModel.statusText;
    }

    if (stepLabelElement) {
      stepLabelElement.textContent = timerModel.stepLabel;
    }

    if (repeatMetaElement) {
      repeatMetaElement.textContent = formatRepeatMeta(timerModel);
    }

    if (cycleProgressElement) {
      cycleProgressElement.innerHTML = renderCycleProgressMarkup(timerModel.cycleDots);
    }

    if (progressBarElement) {
      progressBarElement.setAttribute('aria-valuenow', String(timerModel.progressPercent));
      progressBarElement.setAttribute(
        'aria-valuetext',
        `${timerModel.progressPercent}% complete in current step`
      );
    }

    if (progressFillElement) {
      progressFillElement.style.width = `${timerModel.progressPercent}%`;
    }

    liveUpdateHooks.syncPictureInPicture(timerModel, now);
    liveUpdateHooks.maybeDispatchFocusMinuteReminder(state.activeSession, now);
  }

  function updatePageChrome(now = Date.now()) {
    const title = formatDocumentTitle(state.activeSession, now, APP_NAME);
    const faviconModel = createFaviconModel(state.activeSession, now);
    const signature = `${title}|${faviconModel.text}|${state.activeSession.status}|${Math.ceil(
      getRemainingMs(state.activeSession, now) / 1000
    )}`;

    document.title = title;

    if (signature !== chromeSignature) {
      chromeSignature = signature;
      faviconLink.href = renderFaviconDataUrl(faviconModel);
    }
  }

  function setLiveUpdateHooks(nextHooks) {
    liveUpdateHooks = {
      ...liveUpdateHooks,
      ...nextHooks
    };
  }

  return {
    getTimerModel,
    renderApp,
    setLiveUpdateHooks,
    updatePageChrome,
    updateTimerLiveRegion
  };
}
