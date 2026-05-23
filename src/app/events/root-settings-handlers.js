// @ts-check

import { parseMinutesValue } from '../../core/format.js';
import { syncIdleSessionWithSettings } from '../../core/session.js';
import { normalizeNtfyPublishUrl, sanitizeRepeatCount } from '../../core/settings.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';
import { ALERT_SETTING_KEYS, SETTING_TOGGLE_KEYS } from './root-contracts.js';

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootSettingsHandlers(deps) {
  const { commitSession, persistSettings, postWorkerAction, renderApp, state } = deps;

  function applySettingsMutation(
    mutate,
    { persist = true, rebuildIdleSession = false, rerender = true, syncWorker = false } = {}
  ) {
    mutate();

    if (persist) {
      persistSettings(state);
    }

    if (rebuildIdleSession && state.activeSession.status === 'idle') {
      commitSession(syncIdleSessionWithSettings(state.activeSession, state.settings, Date.now()), {
        dispatchAlerts: false,
        persist: true,
        render: true,
        syncWorker: true
      });
      return;
    }

    if (syncWorker) {
      postWorkerAction(WORKER_ACTIONS.SET_IDLE_REMINDER, {
        enabled: state.settings.idleReminderEnabled
      });
    }

    if (rerender) {
      renderApp();
    }
  }

  /** @type {Map<string, (checked: boolean) => void>} */
  const toggleMutations = new Map([
    [
      SETTING_TOGGLE_KEYS.AUTO_START_NEXT_STEP,
      (checked) => (state.settings.autoStartNextStep = checked)
    ],
    [
      SETTING_TOGGLE_KEYS.PIP_CLOCK_TICK_EVERY_10S,
      (checked) => (state.settings.pipClockTickEvery10s = checked)
    ],
    [
      SETTING_TOGGLE_KEYS.IDLE_REMINDER_ENABLED,
      (checked) => (state.settings.idleReminderEnabled = checked)
    ]
  ]);

  /** @type {Map<string, (checked: boolean) => void>} */
  const alertMutations = new Map([
    [
      ALERT_SETTING_KEYS.SOUND_ENABLED,
      (checked) => (state.settings.alertSettings.soundEnabled = checked)
    ],
    [
      ALERT_SETTING_KEYS.NOTIFICATIONS_ENABLED,
      (checked) => (state.settings.alertSettings.notificationsEnabled = checked)
    ]
  ]);

  function shouldSyncIdleReminderToggle(settingKey) {
    return settingKey === SETTING_TOGGLE_KEYS.IDLE_REMINDER_ENABLED;
  }

  function handleTemplateDurationChange(target) {
    const type = target.dataset.templateDuration;

    if (!type) {
      return false;
    }

    applySettingsMutation(
      () => {
        state.settings.templateDurations[type] = parseMinutesValue(
          target.value,
          state.settings.templateDurations[type]
        );
      },
      {
        rebuildIdleSession: true
      }
    );

    return true;
  }

  function handleRepeatCountChange(target) {
    applySettingsMutation(
      () => {
        state.settings.repeatCount = sanitizeRepeatCount(target.value, state.settings.repeatCount);
      },
      {
        rebuildIdleSession: true
      }
    );

    return true;
  }

  function handleAlertSettingChange(target) {
    const key = target.dataset.alertSetting;

    if (!key || !(target instanceof HTMLInputElement)) {
      return false;
    }

    const mutate = alertMutations.get(key);
    applySettingsMutation(() => {
      if (mutate) {
        mutate(target.checked);
        return;
      }

      state.settings.alertSettings[key] = target.checked;
    });

    return true;
  }

  function handleNtfyPublishUrlChange(target) {
    if (!(target instanceof HTMLInputElement)) {
      return false;
    }

    applySettingsMutation(() => {
      state.settings.ntfyPublishUrl = normalizeNtfyPublishUrl(target.value);
      state.ntfyNotice = '';
    });

    return true;
  }

  function handleSettingToggle(target) {
    const key = target.dataset.settingToggle;

    if (!key || !(target instanceof HTMLInputElement)) {
      return false;
    }

    const mutate = toggleMutations.get(key);

    if (!mutate) {
      return false;
    }

    applySettingsMutation(
      () => {
        mutate(target.checked);
      },
      {
        syncWorker: shouldSyncIdleReminderToggle(key)
      }
    );

    return true;
  }

  /**
   * @param {Event} event
   */
  function handleRootChange(event) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches('[data-template-duration]')) {
      handleTemplateDurationChange(target);
      return;
    }

    if (target.matches('[data-repeat-count]')) {
      handleRepeatCountChange(target);
      return;
    }

    if (target.matches('[data-alert-setting]')) {
      handleAlertSettingChange(target);
      return;
    }

    if (target.matches('[data-ntfy-publish-url]')) {
      handleNtfyPublishUrlChange(target);
      return;
    }

    if (target.matches('[data-setting-toggle]')) {
      handleSettingToggle(target);
    }
  }

  return {
    handleRootChange,
    handleSettingToggle,
    handleTemplateDurationChange
  };
}
