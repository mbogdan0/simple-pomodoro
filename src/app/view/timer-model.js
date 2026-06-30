import {
  FOCUS_TAG_LABELS,
  FOCUS_TAGS,
  PROGRESS_TRACK_COLOR,
  STEP_PALETTE
} from '../../core/constants.js';
import {
  formatClock,
  formatCompactElapsed,
  formatSignedClock,
  formatStepTypeLabel,
  formatStatusLabel
} from '../../core/format.js';
import {
  getCycleRepeatDots,
  getFocusRepeatProgress,
  getStepProgress
} from '../../core/progress.js';
import {
  canResetSession,
  getCurrentStep,
  getElapsedMs,
  getOverrunMs,
  getProgressRatio,
  getRemainingMs,
  hasNextStep,
  isBreakStep,
  isInfiniteSession,
  isWorkStep
} from '../../core/session.js';
import { ROOT_ACTIONS } from '../events/root-contracts.js';

function createStatusDetailText(state, session, now, paused) {
  if (
    state.settings.idleReminderEnabled &&
    session.status === 'idle' &&
    Number.isFinite(state.idleStartedAt)
  ) {
    return formatCompactElapsed(now - state.idleStartedAt);
  }

  if (paused && Number.isFinite(state.pauseStartedAt)) {
    return formatCompactElapsed(now - state.pauseStartedAt);
  }

  return '';
}

function createPrimaryAction(session, step) {
  const stepLabel = formatStepTypeLabel(step?.type);

  if (session.status === 'idle') {
    return {
      action: ROOT_ACTIONS.START_STEP,
      label: `Start ${stepLabel}`
    };
  }

  if (isWorkStep(session)) {
    return {
      action: ROOT_ACTIONS.START_BREAK,
      label: 'Start Break'
    };
  }

  if (isBreakStep(session)) {
    return {
      action: ROOT_ACTIONS.ADVANCE_BREAK,
      label: hasNextStep(session) ? 'Start Focus' : 'Start New Cycle'
    };
  }

  return {
    action: ROOT_ACTIONS.START_STEP,
    label: 'Start'
  };
}

function createSecondaryAction(session) {
  if (session.status === 'running') {
    return {
      action: ROOT_ACTIONS.PAUSE_STEP,
      label: 'Pause Timer'
    };
  }

  if (session.status === 'paused') {
    return {
      action: ROOT_ACTIONS.RESUME_STEP,
      label: 'Resume Timer'
    };
  }

  return null;
}

function createStatusText(session) {
  if (session.status === 'completed_waiting_next') {
    return isWorkStep(session) ? 'Overtime' : 'Over-break';
  }

  return formatStatusLabel(session.status);
}

export function createTimerModel({ pipController, state, now = Date.now() }) {
  const session = state.activeSession;
  const step = getCurrentStep(session);
  const stepType = step?.type ?? 'work';
  const palette = STEP_PALETTE[stepType] ?? STEP_PALETTE.work;
  const paused = session.status === 'paused';
  const completed = session.status === 'completed_waiting_next';
  const infiniteMode = isInfiniteSession(session);
  const pipSupported = pipController.isSupported();
  const clockMs = completed ? getOverrunMs(session, now) : getRemainingMs(session, now);
  const progress = getProgressRatio(session, now);
  const { focusRepeatCurrent, focusRepeatTotal } = getFocusRepeatProgress(session);
  const { stepCurrent, stepTotal } = getStepProgress(session);
  const statusDetailText = createStatusDetailText(state, session, now, paused);
  const primaryAction = createPrimaryAction(session, step);
  const secondaryAction = createSecondaryAction(session);
  const roundLabel = infiniteMode
    ? `${isWorkStep(session) ? 'Focus' : 'Break'} #${Math.max(1, session.roundIndex ?? 1)}`
    : '';

  return {
    accent: palette.accent,
    accentOutline: palette.accentOutline,
    accentSoft: palette.accentSoft,
    backgroundNotice: state.backgroundNotice,
    clock: completed ? formatSignedClock(clockMs) : formatClock(clockMs),
    cycleDots: infiniteMode ? [] : getCycleRepeatDots(session),
    focusSaveActualText: formatCompactElapsed(getElapsedMs(session, now)),
    focusSavePlannedText: formatCompactElapsed(step?.durationMs ?? 0),
    hideCycleProgress: infiniteMode,
    hideRepeatMeta: infiniteMode,
    focusTag: session.focusTag,
    focusTagOptions: FOCUS_TAGS.map((tag) => ({
      id: tag,
      label: FOCUS_TAG_LABELS[tag]
    })),
    focusNoteDraft: state.focusNoteDraft,
    focusRepeatCurrent,
    focusRepeatTotal,
    pipToggleLabel: 'Toggle PiP',
    primaryAction: primaryAction.action,
    primaryActionLabel: primaryAction.label,
    roundLabel,
    secondaryAction,
    showPipToggle: pipSupported,
    progressTrack: PROGRESS_TRACK_COLOR,
    progressPercent: Math.round(progress * 100),
    resetDisabled: !canResetSession(session),
    statusDetailText,
    statusText: createStatusText(session),
    step,
    stepCurrent,
    stepLabel: formatStepTypeLabel(step?.type),
    stepTotal
  };
}
