import { WORKER_ACTIONS } from '../../core/worker-protocol.js';

export function createPipActionHandler({ audioService, postWorkerAction, state }) {
  return function handlePipAction(action) {
    if (action === 'START') {
      audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
      postWorkerAction(WORKER_ACTIONS.START_STEP, {
        settings: state.settings
      });
      return;
    }

    if (action === 'PAUSE') {
      audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
      postWorkerAction(WORKER_ACTIONS.PAUSE);
      return;
    }

    if (action === 'RESUME') {
      audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
      postWorkerAction(WORKER_ACTIONS.RESUME);
    }
  };
}
