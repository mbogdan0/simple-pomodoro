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

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        resyncNow();
        return;
      }

      persistSession(state);
      syncWorkerNow();
      updatePageChrome();
    });

    window.addEventListener('focus', resyncNow);
    window.addEventListener('pageshow', resyncNow);

    window.addEventListener('pagehide', () => {
      persistSession(state);
      syncWorkerNow();
    });

    window.addEventListener('beforeunload', maybeConfirmBeforeUnload);
    window.addEventListener('storage', handleStorageSyncEvent);
  }

  return {
    bindGlobalEvents,
    handleStorageSyncEvent
  };
}
