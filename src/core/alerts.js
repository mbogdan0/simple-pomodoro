import { getCurrentStep } from './session.js';

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
