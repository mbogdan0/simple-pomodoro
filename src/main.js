import {
  buildNotificationTag,
  createCompletionKey,
  resolveCompletionNotificationBody,
  selectNotificationChannel,
  shouldDispatchCompletion,
  shouldDispatchFocusMinuteReminder
} from './core/alerts.js';
import { APP_NAME, STEP_TYPES, STEP_TYPE_LABELS, STORAGE_KEYS, TAB_LABELS } from './core/constants.js';
import { createFaviconModel, renderFaviconDataUrl } from './core/favicon.js';
import {
  appendFocusHistoryEntry,
  createFocusHistoryEntry,
  removeFocusHistoryEntry
} from './core/focus-history.js';
import {
  formatClock,
  formatDocumentTitle,
  formatMinutesValue,
  formatNotificationPermissionLabel,
  formatPipClock,
  formatStepTypeLabel,
  formatStatusLabel,
  parseMinutesValue
} from './core/format.js';
import { getCycleRepeatDots, getFocusRepeatProgress, getStepProgress } from './core/progress.js';
import { createTimerPipController } from './core/pip.js';
import {
  advanceAfterCompletion,
  getCurrentStep,
  getProgressRatio,
  getRemainingMs,
  markAlertsDispatched,
  normalizeSession,
  pauseSession,
  prepareSessionForStepStart,
  resetSession,
  resumeSession,
  syncIdleSessionWithSettings,
  syncSession
} from './core/session.js';
import { sanitizeRepeatCount } from './core/settings.js';
import {
  loadActiveSession,
  loadFocusHistory,
  loadSettings,
  saveActiveSession,
  saveFocusHistory,
  saveSettings
} from './core/storage.js';
import { renderHistoryPanel } from './ui/history-panel.js';
import { renderCycleProgressMarkup, renderTimerPanel } from './ui/timer-panel.js';

const BACKGROUND_UNAVAILABLE_NOTICE = 'Background timer support is currently unavailable.';
const BACKGROUND_UNSUPPORTED_NOTICE =
  'This browser may throttle timer updates in background tabs.';
const RESET_CONFIRMATION_MESSAGE = 'Reset timer to the first step?';
const SERVICE_WORKER_URL = 'service-worker.js';

const STEP_ACCENTS = {
  longBreak: '#3d69c5',
  shortBreak: '#2f8c73',
  work: '#c85a3a'
};

const root = document.querySelector('#app');

if (!root) {
  throw new Error('Cannot find #app root.');
}

const faviconLink = ensureFaviconLink();

const state = {
  activeSession: null,
  backgroundNotice: '',
  focusHistory: loadFocusHistory(),
  lastCompletionKey: '',
  lastFocusMinuteReminderKey: '',
  manualPipRequested: false,
  notificationNotice: '',
  settings: loadSettings(),
  serviceWorkerReady: false
};

state.activeSession = normalizeSession(loadActiveSession(state.settings), state.settings);

let timerWorker = null;
let audioContext = null;
let chromeSignature = '';
let serviceWorkerRegistration = null;
const pipController = createTimerPipController({
  onAction(action) {
    if (action === 'START') {
      postWorkerAction('START_STEP', { settings: state.settings });
      return;
    }

    if (action === 'PAUSE') {
      postWorkerAction('PAUSE');
      return;
    }

    if (action === 'RESUME') {
      postWorkerAction('RESUME');
    }
  },
  onWindowClosed(reason) {
    if (reason === 'user') {
      state.manualPipRequested = false;
      renderApp();
    }
  }
});

persistSettings();
commitSession(syncSession(state.activeSession, Date.now()), {
  dispatchAlerts: true,
  persist: true,
  render: false,
  syncWorker: false
});
renderApp();
primeAudioContextOnGesture();
void registerServiceWorker();
setupWorker();
startSafetyInterval();
bindGlobalEvents();
bindRootEvents();

function ensureFaviconLink() {
  let link = document.querySelector('link[rel="icon"]');

  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.append(link);
  }

  return link;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    return;
  }

  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    serviceWorkerRegistration = await navigator.serviceWorker.ready;
    state.serviceWorkerReady = true;
  } catch {
    state.serviceWorkerReady = false;
  }
}

function createWorkerInstance() {
  if (typeof Worker === 'undefined') {
    state.backgroundNotice = BACKGROUND_UNSUPPORTED_NOTICE;
    return null;
  }

  const inlineSource = globalThis.__TIMER_WORKER_SOURCE__;

  if (typeof inlineSource === 'string' && inlineSource) {
    const blobUrl = URL.createObjectURL(
      new Blob([inlineSource], { type: 'text/javascript' })
    );
    const worker = new Worker(blobUrl);
    worker.addEventListener(
      'message',
      () => {
        URL.revokeObjectURL(blobUrl);
      },
      { once: true }
    );
    state.backgroundNotice = '';
    return worker;
  }

  state.backgroundNotice = '';
  return new Worker('timer-worker.js');
}

function setupWorker() {
  try {
    timerWorker = createWorkerInstance();

    if (!timerWorker) {
      renderApp();
      return;
    }

    timerWorker.addEventListener('message', handleWorkerMessage);
    timerWorker.addEventListener('error', handleWorkerRuntimeError);
    syncWorkerState();
  } catch {
    disableWorkerAndSwitchToLocal(state.activeSession);
  }
}

function disposeWorker() {
  if (!timerWorker) {
    return;
  }

  try {
    timerWorker.removeEventListener('message', handleWorkerMessage);
    timerWorker.removeEventListener('error', handleWorkerRuntimeError);
  } catch {
    // Ignore worker listener cleanup errors.
  }

  try {
    timerWorker.terminate?.();
  } catch {
    // Ignore worker termination errors.
  }

  timerWorker = null;
}

function disableWorkerAndSwitchToLocal(nextSession = state.activeSession) {
  disposeWorker();
  state.backgroundNotice = BACKGROUND_UNAVAILABLE_NOTICE;

  commitSession(syncSession(normalizeSession(nextSession, state.settings), Date.now()), {
    dispatchAlerts: true,
    persist: true,
    render: true,
    syncWorker: false
  });
}

function handleWorkerRuntimeError() {
  disableWorkerAndSwitchToLocal(state.activeSession);
}

function handleWorkerMessage(event) {
  const { completionKey, session, type } = event.data ?? {};

  if (type === 'ERROR') {
    disableWorkerAndSwitchToLocal(session ?? state.activeSession);
    return;
  }

  if (!session) {
    return;
  }

  const normalized = normalizeSession(session, state.settings);

  if (type === 'TICK') {
    const now = Date.now();
    state.activeSession = normalized;
    updateTimerLiveRegion(now);
    updatePageChrome(now);
    return;
  }

  commitSession(normalized, {
    completionKeyHint: completionKey,
    dispatchAlerts: true,
    persist: true,
    render: true,
    syncWorker: type === 'STEP_FINISHED'
  });
}

function bindGlobalEvents() {
  const resyncNow = () => {
    restoreSessionFromStorage();
    reconcileSession();
    syncWorkerNow();
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      resyncNow();
      return;
    }

    persistSession();
    syncWorkerNow();
    updatePageChrome();
  });

  window.addEventListener('focus', resyncNow);
  window.addEventListener('pageshow', resyncNow);

  window.addEventListener('pagehide', () => {
    persistSession();
    syncWorkerNow();
  });

  window.addEventListener('storage', handleStorageSyncEvent);
}

function handleStorageSyncEvent(event) {
  if (!event?.key) {
    return;
  }

  if (event.key === STORAGE_KEYS.settings) {
    state.settings = loadSettings();

    if (state.activeSession.status === 'idle' && state.activeSession.currentStepIndex === 0) {
      const syncedIdleSession = syncIdleSessionWithSettings(
        state.activeSession,
        state.settings,
        Date.now()
      );
      commitSession(syncedIdleSession, {
        dispatchAlerts: false,
        persist: false,
        render: true,
        syncWorker: true
      });
      return;
    }

    renderApp();
    return;
  }

  if (event.key === STORAGE_KEYS.activeSession) {
    restoreSessionFromStorage({
      persist: false
    });
    syncWorkerNow();
  }
}

function bindRootEvents() {
  root.addEventListener('click', handleRootClick);
  root.addEventListener('change', handleRootChange);
}

function primeAudioContextOnGesture() {
  const prime = () => {
    if (typeof window.AudioContext === 'undefined') {
      return;
    }

    if (!audioContext) {
      audioContext = new window.AudioContext();
    }

    audioContext.resume().catch(() => {});
  };

  window.addEventListener('pointerdown', prime, { passive: true });
  window.addEventListener('keydown', prime, { passive: true });
}

function startSafetyInterval() {
  setInterval(() => {
    const now = Date.now();
    reconcileSession();
    updateTimerLiveRegion(now);
    updatePageChrome(now);
  }, 500);
}

function persistSettings() {
  saveSettings(state.settings);
}

function persistSession() {
  saveActiveSession(state.activeSession);
}

function persistFocusHistory() {
  saveFocusHistory(state.focusHistory);
}

function maybeTrackCompletedFocus(session, completionKey = '') {
  const nextEntry = createFocusHistoryEntry(session, completionKey);

  if (!nextEntry) {
    return;
  }

  const nextHistory = appendFocusHistoryEntry(state.focusHistory, nextEntry);

  if (nextHistory.length === state.focusHistory.length) {
    return;
  }

  state.focusHistory = nextHistory;
  persistFocusHistory();
}

function syncWorkerState() {
  if (!timerWorker) {
    return;
  }

  try {
    timerWorker.postMessage({
      payload: {
        session: state.activeSession
      },
      type: 'INIT'
    });
  } catch {
    disableWorkerAndSwitchToLocal(state.activeSession);
  }
}

function syncWorkerNow(now = Date.now()) {
  postWorkerAction('SYNC_NOW', { now });
}

function postWorkerAction(type, payload = {}) {
  if (!timerWorker) {
    handleLocalAction(type, payload);
    return;
  }

  try {
    timerWorker.postMessage({
      payload,
      type
    });
  } catch {
    disableWorkerAndSwitchToLocal(state.activeSession);
    handleLocalAction(type, payload);
  }
}

function restoreSessionFromStorage(options = {}) {
  const { persist = true } = options;
  let storedSession;

  try {
    storedSession = normalizeSession(loadActiveSession(state.settings), state.settings);
  } catch {
    return;
  }

  const localUpdatedAt = state.activeSession?.updatedAt ?? 0;
  const storedUpdatedAt = storedSession.updatedAt ?? 0;

  if (storedUpdatedAt <= localUpdatedAt) {
    return;
  }

  commitSession(storedSession, {
    dispatchAlerts: true,
    persist,
    render: true,
    syncWorker: true
  });
}

function reconcileSession() {
  const synced = syncSession(state.activeSession, Date.now());
  const changed =
    synced.status !== state.activeSession.status ||
    synced.finishedAt !== state.activeSession.finishedAt;

  if (changed) {
    commitSession(synced, {
      dispatchAlerts: true,
      persist: true,
      render: true,
      syncWorker: true
    });
    return;
  }

  state.activeSession = synced;
}

function handleLocalAction(type, payload) {
  const now = payload.now ?? Date.now();
  let nextSession = state.activeSession;

  switch (type) {
    case 'PAUSE':
      nextSession = pauseSession(state.activeSession, now);
      break;
    case 'RESET_ALL':
      nextSession = resetSession(state.activeSession, now);
      nextSession = syncIdleSessionWithSettings(nextSession, payload.settings ?? state.settings, now);
      break;
    case 'RESUME':
      nextSession = resumeSession(state.activeSession, now);
      break;
    case 'START_STEP':
      nextSession = prepareSessionForStepStart(
        state.activeSession,
        payload.settings ?? state.settings,
        now
      );
      break;
    case 'SYNC_NOW':
      reconcileSession();
      return;
    default:
      return;
  }

  commitSession(nextSession, {
    dispatchAlerts: true,
    persist: true,
    render: true,
    syncWorker: false
  });
}

function commitSession(nextSession, options = {}) {
  const {
    completionKeyHint = '',
    dispatchAlerts = false,
    persist = false,
    render = true,
    syncWorker = false
  } = options;

  let session = normalizeSession(nextSession, state.settings);

  if (session.status === 'completed_waiting_next') {
    const completionKey = completionKeyHint || createCompletionKey(session);
    maybeTrackCompletedFocus(session, completionKey);
    const mayDispatchByKey = completionKey
      ? shouldDispatchCompletion(completionKey, state.lastCompletionKey)
      : !session.alertsDispatched;

    if (!completionKey || mayDispatchByKey) {
      if (dispatchAlerts) {
        dispatchCompletionAlerts(session, completionKey);
      }
      session = markAlertsDispatched(session);
    }

    if (completionKey) {
      state.lastCompletionKey = completionKey;
    }

    session = advanceAfterCompletion(session, state.settings, Date.now());
  }

  state.activeSession = session;

  if (persist) {
    persistSession();
  }

  if (render) {
    renderApp();
  } else {
    const now = Date.now();
    updateTimerLiveRegion(now);
    updatePageChrome(now);
  }

  if (syncWorker) {
    syncWorkerState();
  }
}

function dispatchCompletionAlerts(session, completionKey = '') {
  const step = getCurrentStep(session);
  const stepLabel = step ? formatStepTypeLabel(step.type) : 'Step';
  const notificationTag = buildNotificationTag('step-complete', completionKey);

  if (navigator.vibrate) {
    navigator.vibrate([120, 80, 180]);
  }

  if (state.settings.alertSettings.soundEnabled) {
    playCompletionTone();
  }

  if (state.settings.alertSettings.notificationsEnabled) {
    void sendNotificationWithFallback({
      body: resolveCompletionNotificationBody({
        autoStartNextStep: state.settings.autoStartNextStep,
        session
      }),
      silent: !state.settings.alertSettings.soundEnabled,
      tag: notificationTag,
      title: `${stepLabel} completed`
    });
  }
}

function playCompletionTone() {
  if (typeof window.AudioContext === 'undefined') {
    return false;
  }

  if (!audioContext) {
    audioContext = new window.AudioContext();
  }

  const startAt = audioContext.currentTime;
  const totalDuration = 1.05;
  const finishAt = startAt + totalDuration;

  const leadOscillator = audioContext.createOscillator();
  const harmonyOscillator = audioContext.createOscillator();
  const leadGain = audioContext.createGain();
  const harmonyGain = audioContext.createGain();
  const masterGain = audioContext.createGain();

  leadOscillator.type = 'triangle';
  leadOscillator.frequency.setValueAtTime(740, startAt);
  leadOscillator.frequency.linearRampToValueAtTime(980, startAt + 0.18);
  leadOscillator.frequency.linearRampToValueAtTime(840, startAt + 0.48);
  leadOscillator.frequency.linearRampToValueAtTime(1040, startAt + 0.78);
  leadOscillator.frequency.linearRampToValueAtTime(900, finishAt);

  harmonyOscillator.type = 'sine';
  harmonyOscillator.frequency.setValueAtTime(370, startAt);
  harmonyOscillator.frequency.linearRampToValueAtTime(430, startAt + 0.24);
  harmonyOscillator.frequency.linearRampToValueAtTime(390, startAt + 0.6);
  harmonyOscillator.frequency.linearRampToValueAtTime(450, finishAt);

  leadGain.gain.setValueAtTime(0.0001, startAt);
  leadGain.gain.linearRampToValueAtTime(0.24, startAt + 0.05);
  leadGain.gain.linearRampToValueAtTime(0.18, startAt + 0.32);
  leadGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

  harmonyGain.gain.setValueAtTime(0.0001, startAt);
  harmonyGain.gain.linearRampToValueAtTime(0.13, startAt + 0.08);
  harmonyGain.gain.linearRampToValueAtTime(0.1, startAt + 0.38);
  harmonyGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

  masterGain.gain.setValueAtTime(0.9, startAt);

  leadOscillator.connect(leadGain);
  harmonyOscillator.connect(harmonyGain);
  leadGain.connect(masterGain);
  harmonyGain.connect(masterGain);
  masterGain.connect(audioContext.destination);

  leadOscillator.start(startAt);
  harmonyOscillator.start(startAt);
  leadOscillator.stop(finishAt);
  harmonyOscillator.stop(finishAt);
  return true;
}

async function ensureServiceWorkerRegistration() {
  if (serviceWorkerRegistration) {
    return serviceWorkerRegistration;
  }

  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    return null;
  }

  try {
    serviceWorkerRegistration = await navigator.serviceWorker.ready;
    state.serviceWorkerReady = true;
    return serviceWorkerRegistration;
  } catch {
    state.serviceWorkerReady = false;
    return null;
  }
}

async function sendNotificationViaServiceWorker(payload) {
  const registration = await ensureServiceWorkerRegistration();

  if (!registration) {
    return false;
  }

  const worker = registration.active ?? registration.waiting ?? registration.installing;

  if (!worker) {
    return false;
  }

  try {
    const channel = new MessageChannel();
    const responsePromise = new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(false), 1_000);

      channel.port1.onmessage = (event) => {
        clearTimeout(timeoutId);
        resolve(Boolean(event.data?.ok));
      };
    });

    worker.postMessage(
      {
        payload,
        type: 'SHOW_NOTIFICATION'
      },
      [channel.port2]
    );

    return await responsePromise;
  } catch {
    return false;
  }
}

async function sendNotificationWithFallback(payload) {
  const hasNotificationApi = typeof window.Notification === 'function';
  const notificationPermission = hasNotificationApi ? Notification.permission : 'unsupported';
  const channel = selectNotificationChannel({
    hasNotificationApi,
    hasServiceWorker: state.serviceWorkerReady || 'serviceWorker' in navigator,
    notificationPermission
  });

  if (channel === 'window') {
    try {
      new Notification(payload.title, {
        body: payload.body,
        silent: payload.silent,
        tag: payload.tag
      });
      return true;
    } catch {
      return sendNotificationViaServiceWorker(payload);
    }
  }

  if (channel === 'service-worker') {
    return sendNotificationViaServiceWorker(payload);
  }

  return false;
}

function maybeDispatchFocusMinuteReminder(now = Date.now()) {
  const { key, shouldDispatch } = shouldDispatchFocusMinuteReminder({
    notificationsEnabled: state.settings.alertSettings.notificationsEnabled,
    now,
    previousKey: state.lastFocusMinuteReminderKey,
    session: state.activeSession
  });

  if (!shouldDispatch) {
    return;
  }

  state.lastFocusMinuteReminderKey = key;
  void sendNotificationWithFallback({
    body: '1 minute left in this focus session.',
    silent: true,
    tag: buildNotificationTag('focus-minute', key),
    title: 'Focus ending soon'
  });
}

function getTimerModel(now = Date.now()) {
  const session = state.activeSession;
  const step = getCurrentStep(session);
  const running = session.status === 'running';
  const paused = session.status === 'paused';
  const pipSupported = pipController.isSupported();
  const remainingMs = getRemainingMs(session, now);
  const progress = getProgressRatio(session, now);
  const accent = STEP_ACCENTS[step?.type ?? 'work'];
  const { focusRepeatCurrent, focusRepeatTotal } = getFocusRepeatProgress(session);
  const { stepCurrent, stepTotal } = getStepProgress(session);

  return {
    accent,
    backgroundNotice: state.backgroundNotice,
    clock: formatClock(remainingMs),
    cycleDots: getCycleRepeatDots(session),
    focusRepeatCurrent,
    focusRepeatTotal,
    pipToggleDisabled: !pipSupported,
    pipToggleLabel: 'Toggle PiP',
    primaryAction: running ? 'pause-step' : paused ? 'resume-step' : 'start-step',
    primaryActionLabel: running ? 'Pause' : paused ? 'Resume' : 'Start',
    progressPercent: Math.round(progress * 100),
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
        ${activeTab === 'settings' ? renderSettingsPanel() : ''}
        ${activeTab === 'history' ? renderHistoryPanel(state.focusHistory) : ''}
      </section>
    </main>
  `;

  updateTimerLiveRegion();
  updatePageChrome();
}

function renderSettingsPanel() {
  const sessionLocked = ['running', 'paused'].includes(state.activeSession.status);
  const permissionState =
    'Notification' in window ? Notification.permission : 'unsupported';
  const permissionLabel = formatNotificationPermissionLabel(permissionState);
  const pipSupported = pipController.isSupported();

  return `
    <section class="panel settings-layout" id="panel-settings" aria-label="Settings panel" role="region">
      <div class="panel-section">
        <div class="panel-heading">
          <h2>Cycle settings</h2>
          ${sessionLocked ? '<p class="inline-note">Changes apply after reset or after starting a new cycle.</p>' : ''}
        </div>

        <div class="template-grid">
          ${STEP_TYPES.map(
            (type) => `
              <label class="template-card">
                <span>${STEP_TYPE_LABELS[type]}</span>
                <input
                  data-template-duration="${type}"
                  inputmode="numeric"
                  max="480"
                  min="1"
                  type="number"
                  value="${formatMinutesValue(state.settings.templateDurations[type])}"
                >
                <small>minutes</small>
              </label>
            `
          ).join('')}
          <label class="template-card">
            <span>Repeats</span>
            <input
              data-repeat-count
              inputmode="numeric"
              max="24"
              min="1"
              type="number"
              value="${state.settings.repeatCount}"
            >
            <small>focus sessions in one cycle</small>
          </label>
        </div>
        <label class="toggle-row">
          <span>Auto-start next step</span>
          <input
            ${state.settings.autoStartNextStep ? 'checked' : ''}
            data-setting-toggle="autoStartNextStep"
            type="checkbox"
          >
        </label>
      </div>

      <div class="panel-section">
        <div class="panel-heading">
          <h2>Mini window</h2>
        </div>

        <label class="toggle-row">
          <span>Auto-open PiP on Start</span>
          <input
            ${state.settings.pipEnabled ? 'checked' : ''}
            ${pipSupported ? '' : 'disabled'}
            data-setting-toggle="pipEnabled"
            type="checkbox"
          >
        </label>
        <label class="toggle-row">
          <span>PiP clock updates every 10 seconds</span>
          <input
            ${state.settings.pipClockTickEvery10s ? 'checked' : ''}
            ${pipSupported ? '' : 'disabled'}
            data-setting-toggle="pipClockTickEvery10s"
            type="checkbox"
          >
        </label>
      </div>

      <div class="panel-section">
        <div class="panel-heading">
          <h2>Alerts</h2>
        </div>

        <div class="alert-grid">
          <div class="permission-row">
            <span>Status</span>
            <strong>${permissionLabel}</strong>
          </div>
          <label class="toggle-row">
            <span>Sound</span>
            <input
              ${state.settings.alertSettings.soundEnabled ? 'checked' : ''}
              data-alert-setting="soundEnabled"
              type="checkbox"
            >
          </label>
          <label class="toggle-row">
            <span>Notifications</span>
            <input
              ${state.settings.alertSettings.notificationsEnabled ? 'checked' : ''}
              data-alert-setting="notificationsEnabled"
              type="checkbox"
            >
          </label>
          <div class="settings-actions">
            <button class="ghost-button" data-action="request-notification-permission" type="button">
              Allow notifications
            </button>
            <button class="ghost-button" data-action="test-sound" type="button">
              Test sound
            </button>
            <button class="ghost-button" data-action="test-notification" type="button">
              Test notification
            </button>
          </div>
          ${
            state.notificationNotice
              ? `<p class="inline-note">${state.notificationNotice}</p>`
              : ''
          }
        </div>
      </div>
    </section>
  `;
}

function formatRepeatMeta(timerModel) {
  return `Focus repeat ${timerModel.focusRepeatCurrent}/${timerModel.focusRepeatTotal} · Step ${timerModel.stepCurrent}/${timerModel.stepTotal}`;
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

  syncPictureInPicture(timerModel, now);
  maybeDispatchFocusMinuteReminder(now);
}

function syncPictureInPicture(timerModel, now = Date.now()) {
  const status = state.activeSession.status;
  const shouldKeepOpen = state.manualPipRequested ||
    (state.settings.pipEnabled && (status === 'running' || status === 'paused'));

  if (!shouldKeepOpen) {
    pipController.close();
    return;
  }

  const remainingMs = getRemainingMs(state.activeSession, now);
  const pipClock = formatPipClock(
    remainingMs,
    status,
    state.settings.pipClockTickEvery10s
  );

  pipController.update({
    clock: pipClock,
    progressPercent: timerModel.progressPercent,
    status,
    stepLabel: timerModel.stepLabel
  });
}

async function toggleManualPipWindow() {
  if (!pipController.isSupported()) {
    return;
  }

  if (pipController.isOpen()) {
    state.manualPipRequested = false;
    pipController.close();
    renderApp();
    return;
  }

  const opened = await pipController.openFromUserGesture({ bypassDismissLock: true });

  if (!opened) {
    return;
  }

  state.manualPipRequested = true;
  syncPictureInPicture(getTimerModel());
  renderApp();
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

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    state.notificationNotice = 'Notifications are unavailable in this browser.';
    renderApp();
    return;
  }

  Notification.requestPermission().then((permission) => {
    state.notificationNotice = permission === 'granted'
      ? 'Notifications are now allowed.'
      : 'Notification permission was not granted.';
    renderApp();
  });
}

function testSound() {
  const played = playCompletionTone();
  state.notificationNotice = played
    ? 'Test sound played successfully.'
    : 'Sound playback is unavailable in this browser.';
  renderApp();
}

async function testNotification() {
  if (!('Notification' in window) && !('serviceWorker' in navigator)) {
    state.notificationNotice = 'Notifications are unavailable in this browser.';
    renderApp();
    return;
  }

  const sent = await sendNotificationWithFallback({
    body: 'Notification channel check finished.',
    silent: !state.settings.alertSettings.soundEnabled,
    tag: buildNotificationTag('test-notification', String(Date.now())),
    title: 'Notification test'
  });

  state.notificationNotice = sent
    ? 'Test notification was sent.'
    : 'Unable to send a test notification.';
  renderApp();
}

function handleRootClick(event) {
  const button = event.target.closest('[data-action]');

  if (!button) {
    return;
  }

  const { action, tab } = button.dataset;

  switch (action) {
    case 'pause-step':
      postWorkerAction('PAUSE');
      break;
    case 'request-notification-permission':
      requestNotificationPermission();
      break;
    case 'reset-session':
      if (window.confirm(RESET_CONFIRMATION_MESSAGE)) {
        postWorkerAction('RESET_ALL', { settings: state.settings });
      }
      break;
    case 'resume-step':
      postWorkerAction('RESUME');
      break;
    case 'start-step':
      pipController.resetDismissedForNewStart();
      if (state.settings.pipEnabled) {
        void pipController.openFromUserGesture();
      }
      postWorkerAction('START_STEP', { settings: state.settings });
      break;
    case 'toggle-pip-window':
      void toggleManualPipWindow();
      break;
    case 'switch-tab':
      if (tab === 'timer' || tab === 'settings' || tab === 'history') {
        state.settings.lastOpenTab = tab;
        persistSettings();
        renderApp();
      }
      break;
    case 'clear-history-entry': {
      const entryId = button.dataset.entryId;

      if (!entryId) {
        return;
      }

      state.focusHistory = removeFocusHistoryEntry(state.focusHistory, entryId);
      persistFocusHistory();
      renderApp();
      break;
    }
    case 'test-notification':
      void testNotification();
      break;
    case 'test-sound':
      testSound();
      break;
    default:
      break;
  }
}

function handleRootChange(event) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches('[data-template-duration]')) {
    const type = target.dataset.templateDuration;
    if (!type) {
      return;
    }

    state.settings.templateDurations[type] = parseMinutesValue(
      target.value,
      state.settings.templateDurations[type]
    );
    afterSettingsMutation();
    return;
  }

  if (target.matches('[data-repeat-count]')) {
    state.settings.repeatCount = sanitizeRepeatCount(target.value, state.settings.repeatCount);
    afterSettingsMutation();
    return;
  }

  if (target.matches('[data-alert-setting]')) {
    const key = target.dataset.alertSetting;

    if (!key || !(target instanceof HTMLInputElement)) {
      return;
    }

    state.settings.alertSettings[key] = target.checked;
    persistSettings();
    renderApp();
    return;
  }

  if (target.matches('[data-setting-toggle]')) {
    const key = target.dataset.settingToggle;

    if (!key || !(target instanceof HTMLInputElement)) {
      return;
    }

    if (key === 'autoStartNextStep') {
      state.settings.autoStartNextStep = target.checked;
      persistSettings();
      renderApp();
      return;
    }

    if (key === 'pipEnabled') {
      state.settings.pipEnabled = target.checked;
      persistSettings();
      renderApp();
      return;
    }

    if (key === 'pipClockTickEvery10s') {
      state.settings.pipClockTickEvery10s = target.checked;
      persistSettings();
      renderApp();
      return;
    }
  }
}

function afterSettingsMutation() {
  persistSettings();

  if (state.activeSession.status === 'idle') {
    commitSession(syncIdleSessionWithSettings(state.activeSession, state.settings, Date.now()), {
      dispatchAlerts: false,
      persist: true,
      render: true,
      syncWorker: true
    });
    return;
  }

  renderApp();
}
