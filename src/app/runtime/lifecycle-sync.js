import { createLifecycleGlobalEvents } from './lifecycle-global-events.js';
import { createLifecycleStorageSync } from './lifecycle-storage-sync.js';

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
  const storageSync = createLifecycleStorageSync({
    commitSession,
    renderApp,
    restoreSessionFromStorage,
    state,
    syncIdleReminder,
    syncWorkerNow
  });
  const globalEvents = createLifecycleGlobalEvents({
    handleStorageSyncEvent: storageSync.handleStorageSyncEvent,
    persistSession,
    reconcileSession,
    restoreSessionFromStorage,
    state,
    syncWorkerNow,
    updatePageChrome
  });

  return {
    bindGlobalEvents: globalEvents.bindGlobalEvents,
    dispose: globalEvents.dispose,
    handleStorageSyncEvent: storageSync.handleStorageSyncEvent
  };
}
