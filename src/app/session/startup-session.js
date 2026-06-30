import { canResetSession, syncSession } from '../../core/session.js';

export const STALE_SESSION_THRESHOLD_MS = 60 * 60 * 1000;

export function shouldConfirmStaleSession(session, now = Date.now()) {
  if (!canResetSession(session)) {
    return false;
  }

  if (!Number.isFinite(session?.updatedAt)) {
    return false;
  }

  return now - session.updatedAt >= STALE_SESSION_THRESHOLD_MS;
}

export function applyStartupSessionPolicy({ commitSession, now = Date.now(), state }) {
  const shouldShowStaleSessionConfirmation = shouldConfirmStaleSession(state.activeSession, now);

  if (shouldShowStaleSessionConfirmation) {
    state.modal = {
      type: 'stale-session'
    };
  }

  commitSession(syncSession(state.activeSession, now), {
    dispatchAlerts: true,
    persist: true,
    render: false,
    syncWorker: false
  });
}
