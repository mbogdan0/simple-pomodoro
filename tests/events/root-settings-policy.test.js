import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRootSettingsPolicy } from '../../src/app/events/root-settings-policy.js';
import { SETTING_TOGGLE_KEYS } from '../../src/app/events/root-contracts.js';
import { createInitialSession, startCurrentStep } from '../../src/core/session.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { WORKER_ACTIONS } from '../../src/core/worker-protocol.js';

function createState(overrides = {}) {
  const settings = createDefaultSettings();

  return {
    activeSession: createInitialSession(settings),
    backgroundNotice: '',
    focusHistory: [],
    focusNoteDraft: '',
    historyTagEditEntryId: '',
    idleStartedAt: null,
    isNtfyTesting: false,
    lastCompletionKey: '',
    lastFocusMinuteReminderKey: '',
    lastFreeTimerReminderKey: '',
    lastIdleReminderAt: Date.now(),
    manualPipRequested: false,
    notificationNotice: '',
    ntfyNotice: 'old-notice',
    pauseStartedAt: null,
    serviceWorkerReady: false,
    settings,
    ...overrides
  };
}

function createDeps(stateOverrides = {}) {
  const state = createState(stateOverrides);
  const commitSession = vi.fn();
  const persistSettings = vi.fn();
  const postWorkerAction = vi.fn();
  const renderApp = vi.fn();

  return {
    deps: {
      audioService: {
        playCompletionTone: vi.fn(() => true),
        playUiActionTone: vi.fn(() => true)
      },
      commitSession,
      notificationService: {
        requestNotificationPermission: vi.fn(async () => ''),
        testNotification: vi.fn(async () => ''),
        testNtfy: vi.fn(async () => '')
      },
      persistFocusHistory: vi.fn(),
      persistSettings,
      postWorkerAction,
      renderApp,
      root: {
        addEventListener: vi.fn()
      },
      state,
      toggleManualPipWindow: vi.fn(async () => {})
    },
    spies: {
      commitSession,
      persistSettings,
      postWorkerAction,
      renderApp
    },
    state
  };
}

describe('root settings policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('commits rebuilt idle session for template/repeat mutations while idle', () => {
    const { deps, spies, state } = createDeps();
    const policy = createRootSettingsPolicy(deps);

    policy.applyTemplateDurationChange('work', '42');
    expect(state.settings.templateDurations.work).toBe(42 * 60 * 1000);
    expect(spies.persistSettings).toHaveBeenCalledTimes(1);
    expect(spies.commitSession).toHaveBeenCalledTimes(1);

    policy.applyRepeatCountChange('6');
    expect(state.settings.repeatCount).toBe(6);
    expect(spies.persistSettings).toHaveBeenCalledTimes(2);
    expect(spies.commitSession).toHaveBeenCalledTimes(2);
    expect(spies.renderApp).not.toHaveBeenCalled();
  });

  it('re-renders instead of rebuilding session when timer is active', () => {
    const { deps, spies, state } = createDeps({
      activeSession: startCurrentStep(createInitialSession(createDefaultSettings()), 1_000)
    });
    const policy = createRootSettingsPolicy(deps);

    policy.applyTemplateDurationChange('work', '30');

    expect(state.settings.templateDurations.work).toBe(30 * 60 * 1000);
    expect(spies.persistSettings).toHaveBeenCalledTimes(1);
    expect(spies.commitSession).not.toHaveBeenCalled();
    expect(spies.renderApp).toHaveBeenCalledTimes(1);
  });

  it('syncs idle reminder toggle to worker but not other toggles', () => {
    const { deps, spies, state } = createDeps();
    const policy = createRootSettingsPolicy(deps);

    expect(policy.applySettingToggle(SETTING_TOGGLE_KEYS.AUTO_START_NEXT_STEP, true)).toBe(true);
    expect(policy.applySettingToggle(SETTING_TOGGLE_KEYS.PIP_CLOCK_TICK_EVERY_10S, true)).toBe(
      true
    );
    expect(policy.applySettingToggle(SETTING_TOGGLE_KEYS.IDLE_REMINDER_ENABLED, false)).toBe(true);

    expect(state.settings.autoStartNextStep).toBe(true);
    expect(state.settings.pipClockTickEvery10s).toBe(true);
    expect(state.settings.idleReminderEnabled).toBe(false);
    expect(spies.postWorkerAction).toHaveBeenCalledTimes(1);
    expect(spies.postWorkerAction).toHaveBeenCalledWith(WORKER_ACTIONS.SET_IDLE_REMINDER, {
      enabled: false
    });
    expect(spies.persistSettings).toHaveBeenCalledTimes(3);
    expect(spies.renderApp).toHaveBeenCalledTimes(3);
  });

  it('normalizes ntfy URL and clears stale notice', () => {
    const { deps, spies, state } = createDeps();
    const policy = createRootSettingsPolicy(deps);

    policy.applyNtfyPublishUrlChange(' https://ntfy.sh/my-timer ');

    expect(state.settings.ntfyPublishUrl).toBe('https://ntfy.sh/my-timer');
    expect(state.ntfyNotice).toBe('');
    expect(spies.persistSettings).toHaveBeenCalledTimes(1);
    expect(spies.renderApp).toHaveBeenCalledTimes(1);
  });
});
