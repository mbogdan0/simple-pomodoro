import { STEP_TYPE_LABELS } from './constants.js';
import {
  getCurrentStep,
  getOverrunMs,
  getRemainingMs,
  hasNextStep,
  isWorkStep
} from './session.js';

export function createCompletionKey(session) {
  const step = getCurrentStep(session);

  if (!step?.id || !Number.isFinite(session?.finishedAt)) {
    return '';
  }

  return `${step.id}:${session.finishedAt}`;
}

export function shouldDispatchCompletion(nextKey, previousKey) {
  return Boolean(nextKey) && nextKey !== previousKey;
}

export function resolveCompletionNotificationBody({ session }) {
  const hasUpcomingStep = Boolean(session) && hasNextStep(session);
  const stepType = getCurrentStep(session)?.type;

  if (stepType === 'work') {
    return 'Break is ready. Choose how to save this focus session.';
  }

  if (hasUpcomingStep) {
    return 'Next focus is ready. Press Start Focus to continue.';
  }

  return 'Cycle finished. Press Start New Cycle to begin again.';
}

export function resolveCompletionAlertTitle(session) {
  const stepType = getCurrentStep(session)?.type;
  const stepLabel = STEP_TYPE_LABELS[stepType] ?? STEP_TYPE_LABELS.work;

  return `${stepLabel} done ✅`;
}

export function createCompletionAlertPayload({ session }) {
  return {
    body: resolveCompletionNotificationBody({ session }),
    title: resolveCompletionAlertTitle(session)
  };
}

export function selectNotificationChannel({
  hasNotificationApi,
  notificationPermission,
  hasServiceWorker
}) {
  if (hasNotificationApi && notificationPermission === 'granted') {
    return 'window';
  }

  if (hasServiceWorker) {
    return 'service-worker';
  }

  return 'none';
}

export function buildNotificationTag(prefix, uniquePart = '') {
  return uniquePart ? `${prefix}:${uniquePart}` : prefix;
}

export function createFocusMinuteReminderKey(session) {
  const step = getCurrentStep(session);

  if (step?.type !== 'work' || !step.id || !Number.isFinite(session?.stepStartedAt)) {
    return '';
  }

  return `${step.id}:${session.stepStartedAt}`;
}

export function shouldDispatchFocusMinuteReminder({
  session,
  now = Date.now(),
  notificationsEnabled = true,
  previousKey = ''
}) {
  if (!notificationsEnabled || session?.status !== 'running') {
    return {
      key: '',
      shouldDispatch: false
    };
  }

  const remainingMs = getRemainingMs(session, now);

  if (remainingMs <= 0 || remainingMs > 60_000) {
    return {
      key: '',
      shouldDispatch: false
    };
  }

  const key = createFocusMinuteReminderKey(session);

  if (!key || key === previousKey) {
    return {
      key,
      shouldDispatch: false
    };
  }

  return {
    key,
    shouldDispatch: true
  };
}

const FOCUS_OVERTIME_REMINDER_INTERVAL_MS = 5 * 60_000;

export function shouldDispatchFocusOvertimeReminder({
  session,
  now = Date.now(),
  notificationsEnabled = true,
  previousKey = ''
}) {
  if (
    !notificationsEnabled ||
    session?.status !== 'completed_waiting_next' ||
    !isWorkStep(session)
  ) {
    return {
      key: '',
      shouldDispatch: false
    };
  }

  const overrunMs = getOverrunMs(session, now);
  const intervalIndex = Math.floor(overrunMs / FOCUS_OVERTIME_REMINDER_INTERVAL_MS);

  if (intervalIndex < 1) {
    return {
      key: '',
      shouldDispatch: false
    };
  }

  if (!Number.isFinite(session?.finishedAt)) {
    return {
      key: '',
      shouldDispatch: false
    };
  }

  const key = `${getCurrentStep(session)?.id ?? 'focus'}:${session.finishedAt}:${intervalIndex}`;

  if (key === previousKey) {
    return {
      key,
      shouldDispatch: false
    };
  }

  return {
    key,
    shouldDispatch: true
  };
}
