import { applySessionAction, normalizeSession, syncSession } from '../../core/session.js';
import { loadActiveSession } from '../../core/storage.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';
import { reduceCommittedSession } from './session-commit-reducer.js';

export function createSessionController({
  state,
  dispatchCompletionAlerts,
  persistFocusHistory,
  persistSession,
  renderApp,
  syncWorkerState,
  updatePageChrome,
  updateTimerLiveRegion
}) {
  function commitSession(nextSession, options = {}) {
    const {
      completionKeyHint = '',
      completionReason = '',
      dispatchAlerts = false,
      historyEntryHint = null,
      persist = false,
      render = true,
      syncWorker = false
    } = options;

    const previousSession = state.activeSession;
    const committedAt = Date.now();
    const reduced = reduceCommittedSession({
      commitNow: committedAt,
      completionKeyHint,
      completionReason,
      dispatchAlerts,
      focusHistory: state.focusHistory,
      focusNoteDraft: state.focusNoteDraft,
      historyEntryHint,
      idleStartedAt: state.idleStartedAt,
      lastCompletionKey: state.lastCompletionKey,
      nextSession,
      pauseStartedAt: state.pauseStartedAt,
      previousSession,
      settings: state.settings
    });

    state.activeSession = reduced.session;
    state.focusHistory = reduced.focusHistory;
    state.idleStartedAt = reduced.idleStartedAt;
    state.lastCompletionKey = reduced.lastCompletionKey;
    state.pauseStartedAt = reduced.pauseStartedAt;

    const previousStepKey = `${previousSession?.currentStepIndex}:${previousSession?.stepStartedAt}`;
    const nextStepKey = `${state.activeSession?.currentStepIndex}:${state.activeSession?.stepStartedAt}`;

    if (
      previousStepKey !== nextStepKey ||
      state.activeSession?.status !== 'completed_waiting_next'
    ) {
      state.lastOvertimeReminderKey = '';
    }

    if (reduced.shouldPersistFocusHistory) {
      persistFocusHistory(state);
    }

    reduced.completionAlerts.forEach(({ completionKey, session }) => {
      dispatchCompletionAlerts(session, completionKey);
    });

    if (persist) {
      persistSession(state);
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

  function handleLocalAction(type, payload = {}) {
    if (type === WORKER_ACTIONS.SYNC_NOW) {
      reconcileSession();
      return;
    }

    const actionResult = applySessionAction(state.activeSession, type, payload, {
      settings: state.settings
    });

    if (!actionResult.handled) {
      return;
    }

    commitSession(actionResult.nextSession, {
      completionReason: actionResult.completionReason,
      dispatchAlerts: true,
      historyEntryHint: actionResult.historyEntry,
      persist: true,
      render: true,
      syncWorker: false
    });
  }

  return {
    commitSession,
    handleLocalAction,
    reconcileSession,
    restoreSessionFromStorage
  };
}
