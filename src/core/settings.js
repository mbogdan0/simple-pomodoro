import {
  DEFAULT_ALERT_SETTINGS,
  DEFAULT_AUTO_START_NEXT_STEP,
  DEFAULT_PIP_CLOCK_TICK_EVERY_10S,
  DEFAULT_REPEAT_COUNT,
  DEFAULT_TEMPLATE_DURATIONS_MS,
  MAX_REPEAT_COUNT,
  MAX_STEP_DURATION_MS,
  MIN_REPEAT_COUNT,
  MIN_STEP_DURATION_MS,
  STEP_TYPES
} from './constants.js';
import { asFiniteNumber, clamp, createId } from './utils.js';

export function sanitizeDurationMs(value, fallbackMs) {
  const parsed = asFiniteNumber(value, fallbackMs);
  return clamp(Math.round(parsed), MIN_STEP_DURATION_MS, MAX_STEP_DURATION_MS);
}

export function normalizeStepType(type) {
  return STEP_TYPES.includes(type) ? type : 'work';
}

export function createScenarioStep(type = 'work', durationMs = DEFAULT_TEMPLATE_DURATIONS_MS[normalizeStepType(type)]) {
  const normalizedType = normalizeStepType(type);

  return {
    durationMs: sanitizeDurationMs(durationMs, DEFAULT_TEMPLATE_DURATIONS_MS[normalizedType]),
    id: createId('step'),
    type: normalizedType
  };
}

export function normalizeScenarioStep(step, index, templateDurations = DEFAULT_TEMPLATE_DURATIONS_MS) {
  const normalizedType = normalizeStepType(step?.type);
  const fallbackMs = templateDurations[normalizedType] ?? DEFAULT_TEMPLATE_DURATIONS_MS[normalizedType];

  return {
    durationMs: sanitizeDurationMs(step?.durationMs, fallbackMs),
    id: typeof step?.id === 'string' && step.id ? step.id : createId(`step-${index}`),
    type: normalizedType
  };
}

export function sanitizeRepeatCount(value, fallbackCount = DEFAULT_REPEAT_COUNT) {
  const parsed = asFiniteNumber(value, fallbackCount);
  return clamp(Math.round(parsed), MIN_REPEAT_COUNT, MAX_REPEAT_COUNT);
}

export function createDefaultScenario(
  templateDurations = DEFAULT_TEMPLATE_DURATIONS_MS,
  repeatCount = DEFAULT_REPEAT_COUNT
) {
  const repeats = sanitizeRepeatCount(repeatCount, DEFAULT_REPEAT_COUNT);
  const scenario = [];

  for (let index = 0; index < repeats; index += 1) {
    scenario.push(createScenarioStep('work', templateDurations.work));

    if (index < repeats - 1) {
      scenario.push(createScenarioStep('shortBreak', templateDurations.shortBreak));
    }
  }

  scenario.push(createScenarioStep('longBreak', templateDurations.longBreak));
  return scenario;
}

export function normalizeTemplateDurations(rawDurations = {}) {
  return {
    longBreak: sanitizeDurationMs(rawDurations.longBreak, DEFAULT_TEMPLATE_DURATIONS_MS.longBreak),
    shortBreak: sanitizeDurationMs(rawDurations.shortBreak, DEFAULT_TEMPLATE_DURATIONS_MS.shortBreak),
    work: sanitizeDurationMs(rawDurations.work, DEFAULT_TEMPLATE_DURATIONS_MS.work)
  };
}

export function normalizeAlertSettings(rawAlerts = {}) {
  return {
    notificationsEnabled:
      typeof rawAlerts.notificationsEnabled === 'boolean'
        ? rawAlerts.notificationsEnabled
        : DEFAULT_ALERT_SETTINGS.notificationsEnabled,
    soundEnabled:
      typeof rawAlerts.soundEnabled === 'boolean'
        ? rawAlerts.soundEnabled
        : DEFAULT_ALERT_SETTINGS.soundEnabled
  };
}

export function normalizeSettings(rawSettings = {}) {
  const templateDurations = normalizeTemplateDurations(rawSettings.templateDurations);
  const repeatCount = sanitizeRepeatCount(rawSettings.repeatCount, DEFAULT_REPEAT_COUNT);
  const supportedTabs = ['timer', 'settings', 'history'];

  return {
    alertSettings: normalizeAlertSettings(rawSettings.alertSettings),
    autoStartNextStep:
      typeof rawSettings.autoStartNextStep === 'boolean'
        ? rawSettings.autoStartNextStep
        : DEFAULT_AUTO_START_NEXT_STEP,
    lastOpenTab: supportedTabs.includes(rawSettings.lastOpenTab)
      ? rawSettings.lastOpenTab
      : 'timer',
    pipClockTickEvery10s:
      typeof rawSettings.pipClockTickEvery10s === 'boolean'
        ? rawSettings.pipClockTickEvery10s
        : DEFAULT_PIP_CLOCK_TICK_EVERY_10S,
    repeatCount,
    templateDurations
  };
}

export function createDefaultSettings() {
  return normalizeSettings({});
}
