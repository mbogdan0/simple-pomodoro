export { createInitialSession, normalizeSession, syncIdleSessionWithSettings } from './session/normalize.js';
export {
  canResetSession,
  getCurrentStep,
  getCurrentStepDurationMs,
  getProgressRatio,
  getRemainingMs,
  hasNextStep
} from './session/queries.js';
export { syncSession } from './session/sync.js';
export {
  advanceAfterCompletion,
  goToNextStep,
  goToStep,
  markAlertsDispatched,
  pauseSession,
  prepareSessionForStepStart,
  resetCurrentStep,
  resetSession,
  resumeSession,
  setSessionFocusTag,
  startCurrentStep
} from './session/transitions.js';
