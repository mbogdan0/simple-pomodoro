import { describe, expect, it, vi } from 'vitest';

import { createPipActionHandler } from '../src/app/pip/pip-action-handler.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { WORKER_ACTIONS } from '../src/core/worker-protocol.js';

describe('pip action handler', () => {
  it('maps pip actions to worker commands with ui tone', () => {
    const settings = createDefaultSettings();
    settings.alertSettings.soundEnabled = false;
    const playUiActionTone = vi.fn(() => true);
    const postWorkerAction = vi.fn();

    const handlePipAction = createPipActionHandler({
      audioService: {
        playUiActionTone
      },
      postWorkerAction,
      state: {
        settings
      }
    });

    handlePipAction('START');
    handlePipAction('PAUSE');
    handlePipAction('RESUME');
    handlePipAction('UNKNOWN');

    expect(playUiActionTone).toHaveBeenCalledTimes(3);
    expect(playUiActionTone).toHaveBeenNthCalledWith(1, false);
    expect(playUiActionTone).toHaveBeenNthCalledWith(2, false);
    expect(playUiActionTone).toHaveBeenNthCalledWith(3, false);

    expect(postWorkerAction).toHaveBeenNthCalledWith(1, WORKER_ACTIONS.START_STEP, {
      settings
    });
    expect(postWorkerAction).toHaveBeenNthCalledWith(2, WORKER_ACTIONS.PAUSE);
    expect(postWorkerAction).toHaveBeenNthCalledWith(3, WORKER_ACTIONS.RESUME);
    expect(postWorkerAction).toHaveBeenCalledTimes(3);
  });
});
