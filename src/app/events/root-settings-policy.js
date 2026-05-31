// @ts-check

import { parseMinutesValue } from '../../core/format.js';
import { syncIdleSessionWithSettings } from '../../core/session.js';
import { normalizeNtfyPublishUrl, sanitizeRepeatCount } from '../../core/settings.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';
import { ALERT_SETTING_KEYS, SETTING_TOGGLE_KEYS } from './root-contracts.js';

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootSettingsPolicy(deps) {
  const { commitSession, persistSettings, postWorkerAction, renderApp, state } = deps;

  /**
   * @param {() => void} mutate
   * @param {{ persist?: boolean, rebuildIdleSession?: boolean, rerender?: boolean, syncWorker?: boolean }} [options]
   */
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

  function applyTemplateDurationChange(type, value) {
    applySettingsMutation(
      () => {
        state.settings.templateDurations[type] = parseMinutesValue(
          value,
          state.settings.templateDurations[type]
        );
      },
      {
        rebuildIdleSession: true
      }
    );
  }

  function applyRepeatCountChange(value) {
    applySettingsMutation(
      () => {
        state.settings.repeatCount = sanitizeRepeatCount(value, state.settings.repeatCount);
      },
      {
        rebuildIdleSession: true
      }
    );
  }

  function applyAlertSettingChange(key, checked) {
    const mutate = alertMutations.get(key);
    applySettingsMutation(() => {
      if (mutate) {
        mutate(checked);
        return;
      }

      state.settings.alertSettings[key] = checked;
    });
  }

  function applyNtfyPublishUrlChange(value) {
    applySettingsMutation(() => {
      state.settings.ntfyPublishUrl = normalizeNtfyPublishUrl(value);
      state.ntfyNotice = '';
    });
  }

  function applySettingToggle(key, checked) {
    const mutate = toggleMutations.get(key);

    if (!mutate) {
      return false;
    }

    applySettingsMutation(
      () => {
        mutate(checked);
      },
      {
        syncWorker: shouldSyncIdleReminderToggle(key)
      }
    );

    return true;
  }

  return {
    applyAlertSettingChange,
    applyNtfyPublishUrlChange,
    applyRepeatCountChange,
    applySettingToggle,
    applyTemplateDurationChange
  };
}
