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
  syncWorkerNow,
  updatePageChrome
}) {
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

    window.addEventListener('storage', handleStorageSyncEvent);
  }

  return {
    bindGlobalEvents,
    handleStorageSyncEvent
  };
}
