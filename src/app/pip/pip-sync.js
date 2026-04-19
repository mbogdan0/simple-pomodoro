import { formatPipClock } from '../../core/format.js';
import { getRemainingMs } from '../../core/session.js';

export function createPipSync({ state, pipController, getTimerModel, renderApp }) {
  function syncPictureInPicture(timerModel, now = Date.now()) {
    const status = state.activeSession.status;
    const shouldKeepOpen = state.manualPipRequested;

    if (!shouldKeepOpen) {
      pipController.close();
      return;
    }

    const remainingMs = getRemainingMs(state.activeSession, now);
    const pipClock = formatPipClock({
      remainingMs,
      status,
      stepDurationMs: timerModel.step?.durationMs,
      tickEvery10Seconds: state.settings.pipClockTickEvery10s
    });

    pipController.update({
      accent: timerModel.accent,
      clock: pipClock,
      progressTrack: timerModel.progressTrack,
      progressPercent: timerModel.progressPercent,
      status,
      stepLabel: timerModel.stepLabel
    });
  }

  async function toggleManualPipWindow() {
    if (!pipController.isSupported()) {
      return;
    }

    if (pipController.isOpen()) {
      state.manualPipRequested = false;
      pipController.close();
      renderApp();
      return;
    }

    const opened = await pipController.openFromUserGesture();

    if (!opened) {
      return;
    }

    state.manualPipRequested = true;
    syncPictureInPicture(getTimerModel());
    renderApp();
  }

  return {
    syncPictureInPicture,
    toggleManualPipWindow
  };
}
