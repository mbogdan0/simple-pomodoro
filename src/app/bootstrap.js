import { createAudioService } from './alerts/audio-service.js';
import { createNotificationService } from './alerts/notification-service.js';
import { createRootEvents } from './events/root-events.js';
import { createPipSync } from './pip/pip-sync.js';
import { createLifecycleSync } from './runtime/lifecycle-sync.js';
import { createSafetyLoop } from './runtime/safety-loop.js';
import { createServiceWorkerRuntime } from './runtime/service-worker-runtime.js';
import { createWorkerBridge } from './runtime/worker-bridge.js';
import { createWorkerCommandBus } from './runtime/worker-command-bus.js';
import { createSessionController } from './session/session-controller.js';
import { applyStartupSessionPolicy } from './session/startup-session.js';
import {
  createAppState,
  persistFocusHistory,
  persistFocusNoteDraft,
  persistSession,
  persistSettings
} from './state/app-state.js';
import { createAppRenderer } from './view/render-app.js';
import { createTimerPipController } from '../core/pip.js';
import { normalizeSession, syncSession } from '../core/session.js';
import { WORKER_ACTIONS, WORKER_MESSAGE_TYPES } from '../core/worker-protocol.js';

export function startApp(root) {
  if (!root) {
    throw new Error('Cannot find #app root.');
  }

  const state = createAppState();
  const audioService = createAudioService(window);
  const serviceWorkerRuntime = createServiceWorkerRuntime({ state });
  const workerCommandBus = createWorkerCommandBus();
  let disposed = false;

  function clearFocusNoteDraft() {
    state.focusNoteDraft = '';
    persistFocusNoteDraft(state);
  }

  const notificationService = createNotificationService({
    ensureServiceWorkerRegistration: serviceWorkerRuntime.ensureServiceWorkerRegistration,
    playCompletionTone: () => audioService.playCompletionTone(),
    playUiActionTone: (soundEnabled) => audioService.playUiActionTone(soundEnabled),
    state
  });

  const pipController = createTimerPipController({
    onAction(action) {
      if (action === 'START') {
        audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
        workerCommandBus.postWorkerAction(WORKER_ACTIONS.START_STEP, {
          settings: state.settings
        });
        return;
      }

      if (action === 'PAUSE') {
        audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
        workerCommandBus.postWorkerAction(WORKER_ACTIONS.PAUSE);
        return;
      }

      if (action === 'RESUME') {
        audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
        workerCommandBus.postWorkerAction(WORKER_ACTIONS.RESUME);
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
    maybeDispatchFreeTimerReminder: notificationService.maybeDispatchFreeTimerReminder,
    maybeDispatchFocusMinuteReminder: notificationService.maybeDispatchFocusMinuteReminder,
    syncPictureInPicture: pipSync.syncPictureInPicture
  });

  const sessionController = createSessionController({
    dispatchCompletionAlerts: notificationService.dispatchCompletionAlerts,
    persistFocusHistory,
    persistSession,
    renderApp: renderer.renderApp,
    state,
    syncWorkerState: workerCommandBus.syncWorkerState,
    updatePageChrome: renderer.updatePageChrome,
    updateTimerLiveRegion: renderer.updateTimerLiveRegion
  });
  const workerBridge = createWorkerBridge({
    handleLocalAction: sessionController.handleLocalAction,
    onIdleReminder: (now) => notificationService.dispatchIdleReminder(now),
    onWorkerMissing: renderer.renderApp,
    onWorkerState({ completionKey, historyEntry, reason, session, type }) {
      sessionController.commitSession(session, {
        completionKeyHint: completionKey,
        completionReason: reason,
        dispatchAlerts: true,
        historyEntryHint: historyEntry,
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
  workerCommandBus.bindWorkerBridge(workerBridge);

  const lifecycleSync = createLifecycleSync({
    commitSession: sessionController.commitSession,
    persistSession,
    reconcileSession: sessionController.reconcileSession,
    renderApp: renderer.renderApp,
    restoreSessionFromStorage: sessionController.restoreSessionFromStorage,
    state,
    syncIdleReminder: () => {
      workerCommandBus.postWorkerAction(WORKER_ACTIONS.SET_IDLE_REMINDER, {
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
    persistFocusNoteDraft,
    persistSettings,
    postWorkerAction: workerCommandBus.postWorkerAction,
    renderApp: renderer.renderApp,
    root,
    state,
    toggleManualPipWindow: pipSync.toggleManualPipWindow
  });
  const safetyLoop = createSafetyLoop({
    onTick() {
      const now = Date.now();
      sessionController.reconcileSession();
      renderer.updateTimerLiveRegion(now);
      renderer.updatePageChrome(now);
      notificationService.maybeDispatchIdleReminder(now);
    }
  });

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
    safetyLoop.stop();
    rootEvents.dispose?.();
    lifecycleSync.dispose?.();
    workerBridge.disposeWorker();
    pipController.close();
    audioService.dispose?.();
  }

  persistSettings(state);
  applyStartupSessionPolicy({
    commitSession: sessionController.commitSession,
    clearFocusNoteDraft,
    handleLocalAction: sessionController.handleLocalAction,
    state
  });

  renderer.renderApp();
  audioService.primeOnGesture();
  void serviceWorkerRuntime.registerServiceWorker();
  workerBridge.setupWorker();
  workerCommandBus.postWorkerAction(WORKER_ACTIONS.SET_IDLE_REMINDER, {
    enabled: state.settings.idleReminderEnabled
  });
  safetyLoop.start();
  lifecycleSync.bindGlobalEvents();
  rootEvents.bindRootEvents();

  return {
    dispose,
    state
  };
}
