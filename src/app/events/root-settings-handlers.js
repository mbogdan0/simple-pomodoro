// @ts-check

import { parseMinutesValue } from '../../core/format.js';
import { syncIdleSessionWithSettings } from '../../core/session.js';
import { normalizeNtfyPublishUrl, sanitizeRepeatCount } from '../../core/settings.js';
import { WORKER_ACTIONS } from '../../core/worker-protocol.js';

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootSettingsHandlers(deps) {
  const { commitSession, persistSettings, postWorkerAction, renderApp, state } = deps;

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

  function handleTemplateDurationChange(target) {
    const type = target.dataset.templateDuration;

    if (!type) {
      return false;
    }

    state.settings.templateDurations[type] = parseMinutesValue(
      target.value,
      state.settings.templateDurations[type]
    );
    afterSettingsMutation();
    return true;
  }

  function handleRepeatCountChange(target) {
    state.settings.repeatCount = sanitizeRepeatCount(target.value, state.settings.repeatCount);
    afterSettingsMutation();
    return true;
  }

  function handleAlertSettingChange(target) {
    const key = target.dataset.alertSetting;

    if (!key || !(target instanceof HTMLInputElement)) {
      return false;
    }

    state.settings.alertSettings[key] = target.checked;
    persistSettings(state);
    renderApp();
    return true;
  }

  function handleNtfyPublishUrlChange(target) {
    if (!(target instanceof HTMLInputElement)) {
      return false;
    }

    state.settings.ntfyPublishUrl = normalizeNtfyPublishUrl(target.value);
    state.ntfyNotice = '';
    persistSettings(state);
    renderApp();
    return true;
  }

  function handleSettingToggle(target) {
    const key = target.dataset.settingToggle;

    if (!key || !(target instanceof HTMLInputElement)) {
      return false;
    }

    if (key === 'autoStartNextStep') {
      state.settings.autoStartNextStep = target.checked;
      persistSettings(state);
      renderApp();
      return true;
    }

    if (key === 'pipClockTickEvery10s') {
      state.settings.pipClockTickEvery10s = target.checked;
      persistSettings(state);
      renderApp();
      return true;
    }

    if (key === 'idleReminderEnabled') {
      state.settings.idleReminderEnabled = target.checked;
      persistSettings(state);
      postWorkerAction(WORKER_ACTIONS.SET_IDLE_REMINDER, {
        enabled: state.settings.idleReminderEnabled
      });
      renderApp();
      return true;
    }

    return false;
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
