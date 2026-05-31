function shouldConfirmBeforeUnload(sessionStatus) {
  return sessionStatus === 'running' || sessionStatus === 'paused';
}

export function createLifecycleGlobalEvents({
  state,
  handleStorageSyncEvent,
  persistSession,
  reconcileSession,
  restoreSessionFromStorage,
  syncWorkerNow,
  updatePageChrome
}) {
  let boundListeners = null;

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
      if (!event || !shouldConfirmBeforeUnload(state.activeSession.status)) {
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
    dispose
  };
}
