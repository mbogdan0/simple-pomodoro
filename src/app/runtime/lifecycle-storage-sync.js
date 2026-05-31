import { STORAGE_KEYS } from '../../core/constants.js';
import { syncIdleSessionWithSettings } from '../../core/session.js';
import { loadSettings } from '../../core/storage.js';

export function createLifecycleStorageSync({
  state,
  commitSession,
  renderApp,
  restoreSessionFromStorage,
  syncIdleReminder = () => {},
  syncWorkerNow
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

  return {
    handleStorageSyncEvent
  };
}
