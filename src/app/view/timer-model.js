import {
  FOCUS_TAG_LABELS,
  FOCUS_TAGS,
  PROGRESS_TRACK_COLOR,
  STEP_PALETTE
} from '../../core/constants.js';
import {
  formatClock,
  formatCompactElapsed,
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
  canStartFreeTimer,
  getCurrentStep,
  getElapsedMs,
  getProgressRatio,
  getRemainingMs,
  isFreeTimerMode
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

export function createTimerModel({ pipController, state, now = Date.now() }) {
  const session = state.activeSession;
  const freeTimerMode = isFreeTimerMode(session);
  const step = getCurrentStep(session);
  const stepType = step?.type ?? 'work';
  const palette = STEP_PALETTE[stepType] ?? STEP_PALETTE.work;
  const running = session.status === 'running';
  const paused = session.status === 'paused';
  const pipSupported = pipController.isSupported();
  const clockMs = freeTimerMode ? getElapsedMs(session, now) : getRemainingMs(session, now);
  const progress = getProgressRatio(session, now);
  const { focusRepeatCurrent, focusRepeatTotal } = getFocusRepeatProgress(session);
  const { stepCurrent, stepTotal } = getStepProgress(session);
  const statusDetailText = createStatusDetailText(state, session, now, paused);

  return {
    accent: palette.accent,
    accentOutline: palette.accentOutline,
    accentSoft: palette.accentSoft,
    backgroundNotice: state.backgroundNotice,
    clock: formatClock(clockMs),
    cycleDots: freeTimerMode ? [] : getCycleRepeatDots(session),
    endStepEarlyDisabled: freeTimerMode || !(running || paused),
    freeTimerMode,
    hideCycleProgress: freeTimerMode,
    hideRepeatMeta: freeTimerMode,
    focusTag: session.focusTag,
    focusTagOptions: FOCUS_TAGS.map((tag) => ({
      id: tag,
      label: FOCUS_TAG_LABELS[tag]
    })),
    focusNoteDraft: state.focusNoteDraft,
    focusRepeatCurrent,
    focusRepeatTotal,
    pipToggleLabel: 'Toggle PiP',
    showPipToggle: pipSupported,
    showStartFreeTimer: canStartFreeTimer(session),
    showDiscardFreeTimer: freeTimerMode && (running || paused),
    showFinishFreeTimer: freeTimerMode && (running || paused),
    primaryAction: running
      ? ROOT_ACTIONS.PAUSE_STEP
      : paused
        ? ROOT_ACTIONS.RESUME_STEP
        : ROOT_ACTIONS.START_STEP,
    primaryActionLabel: running ? 'Pause' : paused ? 'Resume' : 'Start',
    progressTrack: PROGRESS_TRACK_COLOR,
    progressPercent: Math.round(progress * 100),
    resetDisabled: !canResetSession(session),
    statusDetailText,
    statusText: formatStatusLabel(session.status),
    step,
    stepCurrent,
    stepLabel: freeTimerMode ? 'Free Timer' : formatStepTypeLabel(step?.type),
    stepTotal
  };
}
