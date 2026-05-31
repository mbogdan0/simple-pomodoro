import { createCompletionKey, shouldDispatchCompletion } from '../../core/alerts.js';
import { appendFocusHistoryEntry, createFocusHistoryEntry } from '../../core/focus-history.js';
import {
  advanceAfterCompletion,
  getCurrentStep,
  markAlertsDispatched,
  normalizeSession
} from '../../core/session.js';

function createIdleStepKey(session) {
  if (session?.status !== 'idle') {
    return '';
  }

  return `${session.currentStepIndex}:${getCurrentStep(session)?.id ?? ''}`;
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

export function reduceCommittedSession({
  commitNow,
  completionKeyHint = '',
  completionReason = '',
  dispatchAlerts = false,
  focusHistory = [],
  focusNoteDraft = '',
  historyEntryHint = null,
  idleStartedAt = null,
  lastCompletionKey = '',
  nextSession,
  pauseStartedAt = null,
  previousSession,
  settings
}) {
  let session = normalizeSession(nextSession, settings);
  let nextFocusHistory = focusHistory;
  let nextLastCompletionKey = lastCompletionKey;
  let shouldPersistFocusHistory = false;
  const completionAlerts = [];

  if (historyEntryHint) {
    const appendedHistory = appendFocusHistoryEntry(nextFocusHistory, historyEntryHint);

    if (appendedHistory.length !== nextFocusHistory.length) {
      nextFocusHistory = appendedHistory;
      shouldPersistFocusHistory = true;
    }
  }

  if (session.status === 'completed_waiting_next') {
    const completionKey = completionKeyHint || createCompletionKey(session);
    const shouldSuppressCompletionAlerts = completionReason === 'manual_early';
    const nextEntry = createFocusHistoryEntry(session, completionKey, focusNoteDraft);

    if (nextEntry) {
      const appendedHistory = appendFocusHistoryEntry(nextFocusHistory, nextEntry);

      if (appendedHistory.length !== nextFocusHistory.length) {
        nextFocusHistory = appendedHistory;
        shouldPersistFocusHistory = true;
      }
    }

    const mayDispatchByKey = completionKey
      ? shouldDispatchCompletion(completionKey, lastCompletionKey)
      : !session.alertsDispatched;

    if (!completionKey || mayDispatchByKey) {
      if (dispatchAlerts && !shouldSuppressCompletionAlerts) {
        completionAlerts.push({
          completionKey,
          session
        });
      }

      session = markAlertsDispatched(session);
    }

    if (completionKey) {
      nextLastCompletionKey = completionKey;
    }

    session = advanceAfterCompletion(session, settings, commitNow);
  }

  const nextIdleStartedAt =
    session.status === 'idle'
      ? createIdleStepKey(previousSession) !== createIdleStepKey(session) ||
        !isFiniteNumber(idleStartedAt)
        ? commitNow
        : idleStartedAt
      : null;
  const nextPauseStartedAt =
    session.status === 'paused'
      ? previousSession?.status !== 'paused' || !isFiniteNumber(pauseStartedAt)
        ? commitNow
        : pauseStartedAt
      : null;

  return {
    completionAlerts,
    idleStartedAt: nextIdleStartedAt,
    lastCompletionKey: nextLastCompletionKey,
    pauseStartedAt: nextPauseStartedAt,
    session,
    shouldPersistFocusHistory,
    focusHistory: nextFocusHistory
  };
}
