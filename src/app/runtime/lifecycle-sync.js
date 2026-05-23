import { STORAGE_KEYS } from '../../core/constants.js';
import { syncIdleSessionWithSettings } from '../../core/session.js';
import { loadSettings } from '../../core/storage.js';

export function createLifecycleSync({
  state,
  commitSession,
  persistSession,
  reconcileSession,
  renderApp,
  restoreSessionFromStorage,
  syncIdleReminder = () => {},
  syncWorkerNow,
  updatePageChrome
}) {
  let boundListeners = null;

  function handleStorageSyncEvent(event) {
    if (!event?.key) {
      return;
    }

    if (event.key === STORAGE_KEYS.settings) {
      state.settings = loadSettings();
      syncIdleReminder();

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

  function bindGlobalEvents() {
    if (boundListeners) {
      return;
    }

    const documentTarget = globalThis.document;
    const windowTarget = globalThis.window;
    const resyncNow = () => {
      restoreSessionFromStorage();
      reconcileSession();
      syncWorkerNow();
    };
    const maybeConfirmBeforeUnload = (event) => {
      if (
        !event ||
        (state.activeSession.status !== 'running' && state.activeSession.status !== 'paused')
      ) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };
    const handleVisibilityChange = () => {
      if (!documentTarget.hidden) {
        resyncNow();
        return;
      }

      persistSession(state);
      syncWorkerNow();
      updatePageChrome();
    };
    const handlePageHide = () => {
      persistSession(state);
      syncWorkerNow();
    };

    documentTarget.addEventListener?.('visibilitychange', handleVisibilityChange);
    windowTarget.addEventListener?.('focus', resyncNow);
    windowTarget.addEventListener?.('pageshow', resyncNow);
    windowTarget.addEventListener?.('pagehide', handlePageHide);
    windowTarget.addEventListener?.('beforeunload', maybeConfirmBeforeUnload);
    windowTarget.addEventListener?.('storage', handleStorageSyncEvent);

    boundListeners = {
      documentTarget,
      handlePageHide,
      handleVisibilityChange,
      maybeConfirmBeforeUnload,
      resyncNow,
      windowTarget
    };
  }

  function dispose() {
    if (!boundListeners) {
      return;
    }

    const {
      documentTarget,
      handlePageHide,
      handleVisibilityChange,
      maybeConfirmBeforeUnload,
      resyncNow,
      windowTarget
    } = boundListeners;

    documentTarget.removeEventListener?.('visibilitychange', handleVisibilityChange);
    windowTarget.removeEventListener?.('focus', resyncNow);
    windowTarget.removeEventListener?.('pageshow', resyncNow);
    windowTarget.removeEventListener?.('pagehide', handlePageHide);
    windowTarget.removeEventListener?.('beforeunload', maybeConfirmBeforeUnload);
    windowTarget.removeEventListener?.('storage', handleStorageSyncEvent);
    boundListeners = null;
  }

  return {
    bindGlobalEvents,
    dispose,
    handleStorageSyncEvent
  };
}
