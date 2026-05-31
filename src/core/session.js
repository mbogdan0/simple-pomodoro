export {
  createInitialSession,
  normalizeSession,
  syncIdleSessionWithSettings
} from './session/normalize.js';
export { applySessionAction } from './session/actions.js';
export {
  canResetSession,
  canStartFreeTimer,
  getCurrentStep,
  getCurrentStepDurationMs,
  getElapsedMs,
  getProgressRatio,
  getRemainingMs,
  hasNextStep,
  isFreeTimerMode
} from './session/queries.js';
export { syncSession } from './session/sync.js';
export {
  advanceAfterCompletion,
  forceCompleteCurrentStep,
  goToNextStep,
  markAlertsDispatched,
  pauseSession,
  prepareSessionForStepStart,
  resetFreeTimer,
  resetSession,
  resumeSession,
  startFreeTimer,
  setSessionFocusTag,
  startCurrentStep
} from './session/transitions.js';
