import { createAudioService } from './alerts/audio-service.js';
import { createNotificationService } from './alerts/notification-service.js';
import { createRootEvents } from './events/root-events.js';
import { createPipSync } from './pip/pip-sync.js';
import { createLifecycleSync } from './runtime/lifecycle-sync.js';
import { createWorkerBridge } from './runtime/worker-bridge.js';
import { createSessionController } from './session/session-controller.js';
import {
  createAppState,
  persistFocusHistory,
  persistSession,
  persistSettings
} from './state/app-state.js';
import { createAppRenderer } from './view/render-app.js';
import { createTimerPipController } from '../core/pip.js';
import { normalizeSession, syncSession } from '../core/session.js';
import { WORKER_ACTIONS, WORKER_MESSAGE_TYPES } from '../core/worker-protocol.js';

const SERVICE_WORKER_URL = 'service-worker.js';

export function startApp(root) {
  if (!root) {
    throw new Error('Cannot find #app root.');
  }

  const state = createAppState();
  const audioService = createAudioService(window);
  let serviceWorkerRegistration = null;

  function canUseServiceWorker() {
    const isDevelopmentRuntime = Boolean(globalThis['__APP_DEV__']);
    return !isDevelopmentRuntime && 'serviceWorker' in navigator && window.isSecureContext;
  }

  async function registerServiceWorker() {
    if (!canUseServiceWorker()) {
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

  async function ensureServiceWorkerRegistration() {
    if (serviceWorkerRegistration) {
      return serviceWorkerRegistration;
    }

    if (!canUseServiceWorker()) {
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

  const notificationService = createNotificationService({
    ensureServiceWorkerRegistration,
    playCompletionTone: () => audioService.playCompletionTone(),
    playUiActionTone: (soundEnabled) => audioService.playUiActionTone(soundEnabled),
    state
  });
  let postWorkerAction = () => {};

  const pipController = createTimerPipController({
    onAction(action) {
      if (action === 'START') {
        audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
        postWorkerAction(WORKER_ACTIONS.START_STEP, { settings: state.settings });
        return;
      }

      if (action === 'PAUSE') {
        audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
        postWorkerAction(WORKER_ACTIONS.PAUSE);
        return;
      }

      if (action === 'RESUME') {
        audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
        postWorkerAction(WORKER_ACTIONS.RESUME);
      }
    },
    onWindowClosed(reason) {
      if (reason === 'user') {
        state.manualPipRequested = false;
        renderer.renderApp();
      }
    }
  });
  const renderer = createAppRenderer({
    getNotificationSupportModel: notificationService.getNotificationSupportModel,
    pipController,
    root,
    state
  });
  const pipSync = createPipSync({
    getTimerModel: renderer.getTimerModel,
    pipController,
    renderApp: renderer.renderApp,
    state
  });
  renderer.setLiveUpdateHooks({
    maybeDispatchFocusMinuteReminder: notificationService.maybeDispatchFocusMinuteReminder,
    syncPictureInPicture: pipSync.syncPictureInPicture
  });

  let syncWorkerState = () => {};
  const sessionController = createSessionController({
    dispatchCompletionAlerts: notificationService.dispatchCompletionAlerts,
    persistFocusHistory,
    persistSession,
    renderApp: renderer.renderApp,
    state,
    syncWorkerState: () => syncWorkerState(),
    updatePageChrome: renderer.updatePageChrome,
    updateTimerLiveRegion: renderer.updateTimerLiveRegion
  });
  const workerBridge = createWorkerBridge({
    handleLocalAction: sessionController.handleLocalAction,
    onIdleReminder: (now) => notificationService.dispatchIdleReminder(now),
    onWorkerMissing: renderer.renderApp,
    onWorkerState({ completionKey, reason, session, type }) {
      sessionController.commitSession(session, {
        completionKeyHint: completionKey,
        completionReason: reason,
        dispatchAlerts: true,
        persist: true,
        render: true,
        syncWorker: type === WORKER_MESSAGE_TYPES.STEP_FINISHED
      });
    },
    onWorkerTick() {
      const now = Date.now();
      renderer.updateTimerLiveRegion(now);
      renderer.updatePageChrome(now);
    },
    onWorkerUnavailable(nextSession) {
      const fallbackSession = syncSession(
        normalizeSession(nextSession, state.settings),
        Date.now()
      );
      sessionController.commitSession(fallbackSession, {
        dispatchAlerts: true,
        persist: true,
        render: true,
        syncWorker: false
      });
    },
    state
  });
  postWorkerAction = workerBridge.postWorkerAction;
  syncWorkerState = workerBridge.syncWorkerState;

  const lifecycleSync = createLifecycleSync({
    commitSession: sessionController.commitSession,
    persistSession,
    reconcileSession: sessionController.reconcileSession,
    renderApp: renderer.renderApp,
    restoreSessionFromStorage: sessionController.restoreSessionFromStorage,
    state,
    syncIdleReminder: () => {
      workerBridge.postWorkerAction(WORKER_ACTIONS.SET_IDLE_REMINDER, {
        enabled: state.settings.idleReminderEnabled
      });
    },
    syncWorkerNow: workerBridge.syncWorkerNow,
    updatePageChrome: renderer.updatePageChrome
  });
  const rootEvents = createRootEvents({
    audioService,
    commitSession: sessionController.commitSession,
    notificationService,
    persistFocusHistory,
    persistSettings,
    postWorkerAction: workerBridge.postWorkerAction,
    renderApp: renderer.renderApp,
    root,
    state,
    toggleManualPipWindow: pipSync.toggleManualPipWindow
  });

  function startSafetyInterval() {
    setInterval(() => {
      const now = Date.now();
      sessionController.reconcileSession();
      renderer.updateTimerLiveRegion(now);
      renderer.updatePageChrome(now);
      notificationService.maybeDispatchIdleReminder(now);
    }, 500);
  }

  persistSettings(state);
  sessionController.commitSession(syncSession(state.activeSession, Date.now()), {
    dispatchAlerts: true,
    persist: true,
    render: false,
    syncWorker: false
  });
  renderer.renderApp();
  audioService.primeOnGesture();
  void registerServiceWorker();
  workerBridge.setupWorker();
  workerBridge.postWorkerAction(WORKER_ACTIONS.SET_IDLE_REMINDER, {
    enabled: state.settings.idleReminderEnabled
  });
  startSafetyInterval();
  lifecycleSync.bindGlobalEvents();
  rootEvents.bindRootEvents();

  return {
    state
  };
}
