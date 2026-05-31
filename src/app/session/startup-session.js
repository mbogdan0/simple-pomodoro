import { canResetSession, syncSession } from '../../core/session.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';

export const STALE_SESSION_THRESHOLD_MS = 60 * 60 * 1000;
const STALE_SESSION_CONFIRMATION_MESSAGE =
  'Your previous session was last active over an hour ago. Start a new session now?';

export function shouldConfirmStaleSession(session, now = Date.now()) {
  if (!canResetSession(session)) {
    return false;
  }

  if (!Number.isFinite(session?.updatedAt)) {
    return false;
  }

  return now - session.updatedAt >= STALE_SESSION_THRESHOLD_MS;
}

export function applyStartupSessionPolicy({
  commitSession,
  clearFocusNoteDraft,
  confirmStaleSession = () => globalThis.window?.confirm?.(STALE_SESSION_CONFIRMATION_MESSAGE),
  handleLocalAction,
  now = Date.now(),
  state
}) {
  const shouldShowStaleSessionConfirmation = shouldConfirmStaleSession(state.activeSession, now);

  if (shouldShowStaleSessionConfirmation && confirmStaleSession()) {
    clearFocusNoteDraft();
    handleLocalAction(WORKER_ACTIONS.RESET_ALL, {
      now,
      settings: state.settings
    });
    return;
  }

  commitSession(syncSession(state.activeSession, now), {
    dispatchAlerts: true,
    persist: true,
    render: false,
    syncWorker: false
  });
}
