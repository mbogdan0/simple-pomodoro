import {
  removeFocusHistoryEntry,
  updateFocusHistoryEntryFocusTag
} from '../../core/focus-history.js';
import { parseMinutesValue } from '../../core/format.js';
import { syncIdleSessionWithSettings } from '../../core/session.js';
import { normalizeNtfyPublishUrl, sanitizeRepeatCount } from '../../core/settings.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';

const RESET_CONFIRMATION_MESSAGE = 'Reset all steps and return to the first step?';
const END_STEP_EARLY_CONFIRMATION_MESSAGE = 'End the current step now?';

export function createRootEvents({
  state,
  root,
  audioService,
  commitSession,
  notificationService,
  persistFocusHistory,
  persistSettings,
  postWorkerAction,
  renderApp,
  toggleManualPipWindow
}) {
  function playUiActionTone() {
    audioService.playUiActionTone(state.settings.alertSettings.soundEnabled);
  }

  function testSound() {
    const played = audioService.playCompletionTone();
    state.notificationNotice = played
      ? 'Test sound played successfully.'
      : 'Sound playback is unavailable in this browser.';
    renderApp();
  }

  function afterSettingsMutation() {
    persistSettings(state);

    if (state.activeSession.status === 'idle') {
      commitSession(syncIdleSessionWithSettings(state.activeSession, state.settings, Date.now()), {
        dispatchAlerts: false,
        persist: true,
        render: true,
        syncWorker: true
      });
      return;
    }

    renderApp();
  }

  async function testNtfy() {
    if (state.isNtfyTesting) {
      return;
    }

    if (!state.settings.ntfyPublishUrl) {
      state.ntfyNotice = 'Set a valid ntfy publish URL first.';
      renderApp();
      return;
    }

    state.isNtfyTesting = true;
    renderApp();

    try {
      await notificationService.testNtfy();
    } finally {
      state.isNtfyTesting = false;
    }

    renderApp();
  }

  function closeOverflowActionsMenu(button) {
    const parentDetails = button.closest('details');

    if (parentDetails && typeof parentDetails === 'object' && 'open' in parentDetails) {
      parentDetails.open = false;
    }
  }

  function closeAllOverflowActionsMenus() {
    if (typeof root.querySelectorAll !== 'function') {
      return;
    }

    root.querySelectorAll('.overflow-actions[open]').forEach((menu) => {
      menu.open = false;
    });
  }

  function handleRootClick(event) {
    const target = event?.target;
    const clickedInsideOverflowMenu = Boolean(target?.closest?.('.overflow-actions'));

    if (!clickedInsideOverflowMenu) {
      closeAllOverflowActionsMenus();
    }

    if (target?.closest?.('.action-button--overflow')) {
      playUiActionTone();
    }

    const button = target?.closest?.('[data-action]');

    if (!button) {
      return;
    }

    const { action, tab } = button.dataset;

    switch (action) {
      case 'pause-step':
        playUiActionTone();
        postWorkerAction(WORKER_ACTIONS.PAUSE);
        break;
      case 'request-notification-permission':
        notificationService.requestNotificationPermission().then(() => {
          renderApp();
        });
        break;
      case 'reset-session':
        closeOverflowActionsMenu(button);
        if (window.confirm(RESET_CONFIRMATION_MESSAGE)) {
          playUiActionTone();
          postWorkerAction(WORKER_ACTIONS.RESET_ALL, { settings: state.settings });
        }
        break;
      case 'end-step-early':
        closeOverflowActionsMenu(button);
        if (window.confirm(END_STEP_EARLY_CONFIRMATION_MESSAGE)) {
          playUiActionTone();
          postWorkerAction(WORKER_ACTIONS.END_STEP_EARLY);
        }
        break;
      case 'resume-step':
        playUiActionTone();
        postWorkerAction(WORKER_ACTIONS.RESUME);
        break;
      case 'start-step':
        playUiActionTone();
        postWorkerAction(WORKER_ACTIONS.START_STEP, { settings: state.settings });
        break;
      case 'set-focus-tag': {
        const focusTag = button.dataset.focusTag;

        if (!focusTag) {
          return;
        }

        playUiActionTone();
        postWorkerAction(WORKER_ACTIONS.SET_FOCUS_TAG, { focusTag });
        break;
      }
      case 'toggle-pip-window':
        playUiActionTone();
        void toggleManualPipWindow();
        break;
      case 'switch-tab':
        if (tab === 'timer' || tab === 'settings' || tab === 'history') {
          playUiActionTone();
          state.settings.lastOpenTab = tab;
          persistSettings(state);
          renderApp();
        }
        break;
      case 'clear-history-entry': {
        const entryId = button.dataset.entryId;

        if (!entryId) {
          return;
        }

        state.focusHistory = removeFocusHistoryEntry(state.focusHistory, entryId);
        if (state.historyTagEditEntryId === entryId) {
          state.historyTagEditEntryId = '';
        }
        persistFocusHistory(state);
        renderApp();
        break;
      }
      case 'toggle-history-entry-tag-edit': {
        const entryId = button.dataset.entryId;

        if (!entryId) {
          return;
        }

        state.historyTagEditEntryId = state.historyTagEditEntryId === entryId ? '' : entryId;
        renderApp();
        break;
      }
      case 'set-history-entry-focus-tag': {
        const entryId = button.dataset.entryId;
        const focusTag = button.dataset.focusTag;

        if (!entryId || !focusTag) {
          return;
        }

        state.focusHistory = updateFocusHistoryEntryFocusTag(state.focusHistory, entryId, focusTag);
        state.historyTagEditEntryId = '';
        persistFocusHistory(state);
        renderApp();
        break;
      }
      case 'test-notification':
        notificationService.testNotification().then(() => {
          renderApp();
        });
        break;
      case 'test-sound':
        testSound();
        break;
      case 'test-ntfy':
        void testNtfy();
        break;
      default:
        break;
    }
  }

  function handleDocumentClick(event) {
    const target = event?.target;

    if (target?.closest?.('.overflow-actions')) {
      return;
    }

    closeAllOverflowActionsMenus();
  }

  function handleRootChange(event) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches('[data-template-duration]')) {
      const type = target.dataset.templateDuration;
      if (!type) {
        return;
      }

      state.settings.templateDurations[type] = parseMinutesValue(
        target.value,
        state.settings.templateDurations[type]
      );
      afterSettingsMutation();
      return;
    }

    if (target.matches('[data-repeat-count]')) {
      state.settings.repeatCount = sanitizeRepeatCount(target.value, state.settings.repeatCount);
      afterSettingsMutation();
      return;
    }

    if (target.matches('[data-alert-setting]')) {
      const key = target.dataset.alertSetting;

      if (!key || !(target instanceof HTMLInputElement)) {
        return;
      }

      state.settings.alertSettings[key] = target.checked;
      persistSettings(state);
      renderApp();
      return;
    }

    if (target.matches('[data-ntfy-publish-url]')) {
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      state.settings.ntfyPublishUrl = normalizeNtfyPublishUrl(target.value);
      state.ntfyNotice = '';
      persistSettings(state);
      renderApp();
      return;
    }

    if (target.matches('[data-setting-toggle]')) {
      const key = target.dataset.settingToggle;

      if (!key || !(target instanceof HTMLInputElement)) {
        return;
      }

      if (key === 'autoStartNextStep') {
        state.settings.autoStartNextStep = target.checked;
        persistSettings(state);
        renderApp();
        return;
      }

      if (key === 'pipClockTickEvery10s') {
        state.settings.pipClockTickEvery10s = target.checked;
        persistSettings(state);
        renderApp();
        return;
      }

      if (key === 'idleReminderEnabled') {
        state.settings.idleReminderEnabled = target.checked;
        persistSettings(state);
        postWorkerAction(WORKER_ACTIONS.SET_IDLE_REMINDER, {
          enabled: state.settings.idleReminderEnabled
        });
        renderApp();
      }
    }
  }

  function bindRootEvents() {
    root.addEventListener('click', handleRootClick);
    root.addEventListener('change', handleRootChange);
    document.addEventListener('click', handleDocumentClick);
  }

  return {
    bindRootEvents,
    handleRootChange,
    handleRootClick
  };
}
