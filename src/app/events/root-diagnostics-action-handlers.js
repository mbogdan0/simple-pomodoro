// @ts-check

import { ROOT_ACTIONS } from './root-contracts.js';

export function createRootDiagnosticsActionHandlers({
  notificationService,
  playCompletionTone,
  playUiActionTone,
  renderApp,
  runAsyncAction,
  state,
  toggleManualPipWindow
}) {
  function testSound() {
    const played = playCompletionTone();
    state.notificationNotice = played
      ? 'Test sound played successfully.'
      : 'Sound playback is unavailable in this browser.';
    renderApp();
  }

  function testNtfy() {
    if (state.isNtfyTesting) {
      return;
    }

    if (!state.settings.ntfyPublishUrl) {
      state.ntfyNotice = 'Set a valid ntfy publish URL first.';
      renderApp();
      return;
    }

    runAsyncAction(() => notificationService.testNtfy(), {
      onAfter: () => {
        state.isNtfyTesting = false;
        renderApp();
      },
      onBefore: () => {
        state.isNtfyTesting = true;
        renderApp();
      }
    });
  }

  return {
    [ROOT_ACTIONS.REQUEST_NOTIFICATION_PERMISSION]: () => {
      runAsyncAction(() => notificationService.requestNotificationPermission(), {
        onAfter: renderApp
      });
    },
    [ROOT_ACTIONS.TEST_NOTIFICATION]: () => {
      runAsyncAction(() => notificationService.testNotification(), {
        onAfter: renderApp
      });
    },
    [ROOT_ACTIONS.TEST_NTFY]: () => {
      void testNtfy();
    },
    [ROOT_ACTIONS.TEST_SOUND]: () => {
      testSound();
    },
    [ROOT_ACTIONS.TOGGLE_PIP_WINDOW]: () => {
      playUiActionTone();
      runAsyncAction(() => toggleManualPipWindow());
    }
  };
}
