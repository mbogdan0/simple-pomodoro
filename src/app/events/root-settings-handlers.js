// @ts-check

import { createRootSettingsPolicy } from './root-settings-policy.js';

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootSettingsHandlers(deps) {
  const settingsPolicy = createRootSettingsPolicy(deps);

  function handleTemplateDurationChange(target) {
    const type = target.dataset.templateDuration;

    if (!type) {
      return false;
    }

    settingsPolicy.applyTemplateDurationChange(type, target.value);

    return true;
  }

  function handleRepeatCountChange(target) {
    settingsPolicy.applyRepeatCountChange(target.value);

    return true;
  }

  function handleAlertSettingChange(target) {
    const key = target.dataset.alertSetting;

    if (!key || !(target instanceof HTMLInputElement)) {
      return false;
    }

    settingsPolicy.applyAlertSettingChange(key, target.checked);

    return true;
  }

  function handleNtfyPublishUrlChange(target) {
    if (!(target instanceof HTMLInputElement)) {
      return false;
    }

    settingsPolicy.applyNtfyPublishUrlChange(target.value);

    return true;
  }

  function handleSettingToggle(target) {
    const key = target.dataset.settingToggle;

    if (!key || !(target instanceof HTMLInputElement)) {
      return false;
    }

    return settingsPolicy.applySettingToggle(key, target.checked);
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
