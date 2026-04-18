import { APP_NAME, STATUS_LABELS, STEP_TYPE_LABELS } from './constants.js';
import { getCurrentStep, getRemainingMs } from './session.js';
import { clamp } from './utils.js';

export function formatClock(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function toWholeSeconds(valueMs) {
  const parsed = Number(valueMs);
  return Number.isFinite(parsed) ? Math.max(0, Math.ceil(parsed / 1000)) : null;
}

export function formatPipClock({
  remainingMs,
  status,
  stepDurationMs,
  tickEvery10Seconds = false
}) {
  if (!tickEvery10Seconds || status !== 'running') {
    return formatClock(remainingMs);
  }

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const stepDurationSeconds = toWholeSeconds(stepDurationMs);
  const elapsedSeconds =
    stepDurationSeconds === null
      ? null
      : Math.max(0, stepDurationSeconds - remainingSeconds);

  if (elapsedSeconds !== null && elapsedSeconds < 10) {
    return formatClock(remainingMs);
  }

  if (remainingSeconds <= 9) {
    return formatClock(remainingMs);
  }

  const roundedUpTo10Seconds = Math.ceil(remainingSeconds / 10) * 10;
  return formatClock(roundedUpTo10Seconds * 1000);
}

export function formatStepTypeLabel(type) {
  return STEP_TYPE_LABELS[type] ?? STEP_TYPE_LABELS.work;
}

export function formatStatusLabel(status) {
  return STATUS_LABELS[status] ?? STATUS_LABELS.idle;
}

export function formatMinutesValue(durationMs) {
  return String(Math.round(durationMs / 60000));
}

export function parseMinutesValue(value, fallbackMs) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallbackMs;
  }

  return clamp(Math.round(parsed), 1, 480) * 60 * 1000;
}

export function formatNotificationPermissionLabel(permissionState) {
  if (permissionState === 'granted') {
    return 'Allowed';
  }

  if (permissionState === 'denied' || permissionState === 'default') {
    return 'Not allowed';
  }

  return 'Unavailable';
}

export function formatDocumentTitle(session, now = Date.now(), appName = APP_NAME) {
  const step = getCurrentStep(session);

  if (!step) {
    return appName;
  }

  const base = `${formatClock(getRemainingMs(session, now))} · ${formatStepTypeLabel(step.type)}`;

  if (session.status === 'completed_waiting_next') {
    return `${base} ready`;
  }

  return base;
}
