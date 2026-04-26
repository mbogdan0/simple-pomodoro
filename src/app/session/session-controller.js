import {
  createCompletionKey,
  shouldDispatchCompletion
} from '../../core/alerts.js';
import {
  appendFocusHistoryEntry,
  createFocusHistoryEntry
} from '../../core/focus-history.js';
import {
  advanceAfterCompletion,
  forceCompleteCurrentStep,
  getCurrentStep,
  markAlertsDispatched,
  normalizeSession,
  pauseSession,
  prepareSessionForStepStart,
  resetSession,
  resumeSession,
  setSessionFocusTag,
  syncIdleSessionWithSettings,
  syncSession
} from '../../core/session.js';
import { loadActiveSession } from '../../core/storage.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';

function createIdleStepKey(session) {
  if (session?.status !== 'idle') {
    return '';
  }

  return `${session.currentStepIndex}:${getCurrentStep(session)?.id ?? ''}`;
}

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
    persistFocusHistory(state);
  }

  function commitSession(nextSession, options = {}) {
    const {
      completionKeyHint = '',
      completionReason = '',
      dispatchAlerts = false,
      persist = false,
      render = true,
      syncWorker = false
    } = options;

    const previousSession = state.activeSession;
    const committedAt = Date.now();
    let session = normalizeSession(nextSession, state.settings);

    if (session.status === 'completed_waiting_next') {
      const completionKey = completionKeyHint || createCompletionKey(session);
      const shouldSuppressCompletionAlerts = completionReason === 'manual_early';
      maybeTrackCompletedFocus(session, completionKey);
      const mayDispatchByKey = completionKey
        ? shouldDispatchCompletion(completionKey, state.lastCompletionKey)
        : !session.alertsDispatched;

      if (!completionKey || mayDispatchByKey) {
        if (dispatchAlerts && !shouldSuppressCompletionAlerts) {
          dispatchCompletionAlerts(session, completionKey);
        }
        session = markAlertsDispatched(session);
      }

      if (completionKey) {
        state.lastCompletionKey = completionKey;
      }

      session = advanceAfterCompletion(session, state.settings, committedAt);
    }

    state.activeSession = session;

    if (session.status === 'idle') {
      const previousIdleStepKey = createIdleStepKey(previousSession);
      const nextIdleStepKey = createIdleStepKey(session);

      if (
        previousIdleStepKey !== nextIdleStepKey ||
        !Number.isFinite(state.idleStartedAt)
      ) {
        state.idleStartedAt = committedAt;
      }
    } else {
      state.idleStartedAt = null;
    }

    if (session.status === 'paused') {
      if (previousSession?.status !== 'paused' || !Number.isFinite(state.pauseStartedAt)) {
        state.pauseStartedAt = committedAt;
      }
    } else {
      state.pauseStartedAt = null;
    }

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
    const now = payload.now ?? Date.now();
    let nextSession = state.activeSession;
    let completionReason = '';

    switch (type) {
      case WORKER_ACTIONS.END_STEP_EARLY:
        nextSession = forceCompleteCurrentStep(state.activeSession, now);
        completionReason = 'manual_early';
        break;
      case WORKER_ACTIONS.PAUSE:
        nextSession = pauseSession(state.activeSession, now);
        break;
      case WORKER_ACTIONS.RESET_ALL:
        nextSession = resetSession(state.activeSession, now);
        nextSession = syncIdleSessionWithSettings(nextSession, payload.settings ?? state.settings, now);
        break;
      case WORKER_ACTIONS.RESUME:
        nextSession = resumeSession(state.activeSession, now);
        break;
      case WORKER_ACTIONS.START_STEP:
        nextSession = prepareSessionForStepStart(
          state.activeSession,
          payload.settings ?? state.settings,
          now
        );
        break;
      case WORKER_ACTIONS.SET_FOCUS_TAG:
        nextSession = setSessionFocusTag(state.activeSession, payload.focusTag, now);
        break;
      case WORKER_ACTIONS.SYNC_NOW:
        reconcileSession();
        return;
      default:
        return;
    }

    commitSession(nextSession, {
      dispatchAlerts: true,
      persist: true,
      render: true,
      syncWorker: false,
      completionReason
    });
  }

  return {
    commitSession,
    handleLocalAction,
    reconcileSession,
    restoreSessionFromStorage
  };
}
