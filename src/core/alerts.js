import { STEP_TYPE_LABELS } from './constants.js';
import { getCurrentStep, getRemainingMs, hasNextStep } from './session.js';

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

export function resolveCompletionNotificationBody({ autoStartNextStep = false, session }) {
  const hasUpcomingStep = Boolean(session) && hasNextStep(session);

  if (autoStartNextStep && hasUpcomingStep) {
    return 'Next step started automatically.';
  }

  if (hasUpcomingStep) {
    return 'Next step is ready. Press Start to continue.';
  }

  return 'Cycle finished. Press Start to begin a new cycle.';
}

export function resolveCompletionAlertTitle(session) {
  const stepType = getCurrentStep(session)?.type;
  const stepLabel = STEP_TYPE_LABELS[stepType] ?? STEP_TYPE_LABELS.work;

  return `${stepLabel} done ✅`;
}

export function createCompletionAlertPayload({ autoStartNextStep = false, session }) {
  return {
    body: resolveCompletionNotificationBody({
      autoStartNextStep,
      session
    }),
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
