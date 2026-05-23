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
  formatCompactElapsed,
  formatDocumentTitle,
  formatNotificationPermissionLabel,
  formatStepTypeLabel,
  formatStatusLabel
} from '../../core/format.js';
import {
  getCycleRepeatDots,
  getFocusRepeatProgress,
  getStepProgress
} from '../../core/progress.js';
import {
  canResetSession,
  getCurrentStep,
  getProgressRatio,
  getRemainingMs
} from '../../core/session.js';
import { renderHistoryPanel } from '../../ui/history-panel.js';
import { renderSettingsPanel } from '../../ui/settings-panel.js';
import { renderCycleProgressMarkup, renderTimerPanel } from '../../ui/timer-panel.js';
import { ROOT_ACTIONS, ROOT_TABS } from '../events/root-contracts.js';

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

function collectLiveRefs(root) {
  return {
    clockElement: root.querySelector('[data-live-clock]'),
    cycleProgressElement: root.querySelector('[data-live-cycle-progress]'),
    progressBarElement: root.querySelector('[data-live-progress]'),
    progressFillElement: root.querySelector('[data-live-progress-fill]'),
    repeatMetaElement: root.querySelector('[data-live-repeat-meta]'),
    statusDetailElement: root.querySelector('[data-live-status-detail]'),
    statusElement: root.querySelector('[data-live-status]'),
    statusTextElement: root.querySelector('[data-live-status-text]'),
    stepLabelElement: root.querySelector('[data-live-step-label]')
  };
}

function patchLiveTimerDom(refs, timerModel) {
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
    refs.repeatMetaElement.textContent = formatRepeatMeta(timerModel);
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

export function createAppRenderer({ root, state, pipController, getNotificationSupportModel }) {
  const faviconLink = ensureFaviconLink();
  let chromeSignature = '';
  let liveRefs = collectLiveRefs(root);
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
    const statusDetailText =
      state.settings.idleReminderEnabled &&
      session.status === 'idle' &&
      Number.isFinite(state.idleStartedAt)
        ? formatCompactElapsed(now - state.idleStartedAt)
        : paused && Number.isFinite(state.pauseStartedAt)
          ? formatCompactElapsed(now - state.pauseStartedAt)
          : '';

    return {
      accent: palette.accent,
      accentOutline: palette.accentOutline,
      accentSoft: palette.accentSoft,
      backgroundNotice: state.backgroundNotice,
      clock: formatClock(remainingMs),
      cycleDots: getCycleRepeatDots(session),
      endStepEarlyDisabled: !(running || paused),
      focusTag: session.focusTag,
      focusTagOptions: FOCUS_TAGS.map((tag) => ({
        id: tag,
        label: FOCUS_TAG_LABELS[tag]
      })),
      focusNoteDraft: state.focusNoteDraft,
      focusRepeatCurrent,
      focusRepeatTotal,
      pipToggleLabel: 'Toggle PiP',
      showPipToggle: pipSupported,
      primaryAction: running
        ? ROOT_ACTIONS.PAUSE_STEP
        : paused
          ? ROOT_ACTIONS.RESUME_STEP
          : ROOT_ACTIONS.START_STEP,
      primaryActionLabel: running ? 'Pause' : paused ? 'Resume' : 'Start',
      progressTrack: PROGRESS_TRACK_COLOR,
      progressPercent: Math.round(progress * 100),
      resetDisabled: !canResetSession(session),
      statusDetailText,
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
                    data-action="${ROOT_ACTIONS.SWITCH_TAB}"
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
          ${activeTab === ROOT_TABS.TIMER ? renderTimerPanel(timerModel) : ''}
          ${
            activeTab === ROOT_TABS.SETTINGS
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
          ${
            activeTab === ROOT_TABS.HISTORY
              ? renderHistoryPanel(
                  state.focusHistory,
                  state.historyTagEditEntryId,
                  state.historyNoteEditEntryId
                )
              : ''
          }
        </section>
      </main>
    `;

    liveRefs = collectLiveRefs(root);
    updateTimerLiveRegion();
    updatePageChrome();
  }

  function updateTimerLiveRegion(now = Date.now()) {
    const timerModel = getTimerModel(now);
    if (!liveRefs.clockElement && !liveRefs.statusElement) {
      liveRefs = collectLiveRefs(root);
    }

    patchLiveTimerDom(liveRefs, timerModel);
    liveUpdateHooks.syncPictureInPicture(timerModel, now);
    liveUpdateHooks.maybeDispatchFocusMinuteReminder(state.activeSession, now);
  }

  function updatePageChrome(now = Date.now()) {
    const title = formatDocumentTitle(state.activeSession, now, APP_NAME);
    const faviconModel = createFaviconModel(state.activeSession, now);
    const signature = `${title}|${state.activeSession.status}|${Math.ceil(
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
