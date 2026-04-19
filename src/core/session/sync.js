import { BACKGROUND_COMPLETION_THRESHOLD_MS } from '../constants.js';

export function syncSession(session, now = Date.now()) {
  if (session.status !== 'running') {
    return session;
  }

  if (now < (session.endsAt ?? 0)) {
    return session;
  }

  return {
    ...session,
    completedInBackground: now - (session.endsAt ?? now) > BACKGROUND_COMPLETION_THRESHOLD_MS,
    endsAt: session.endsAt,
    finishedAt: session.endsAt ?? now,
    remainingMsAtPause: 0,
    status: 'completed_waiting_next',
    updatedAt: now
  };
}
