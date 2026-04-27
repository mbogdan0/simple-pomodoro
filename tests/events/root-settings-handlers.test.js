import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRootSettingsHandlers } from '../../src/app/events/root-settings-handlers.js';
import { createInitialSession } from '../../src/core/session.js';
import { createDefaultSettings } from '../../src/core/settings.js';
import { WORKER_ACTIONS } from '../../src/core/worker-protocol.js';

const originalHTMLElement = globalThis.HTMLElement;
const originalHTMLInputElement = globalThis.HTMLInputElement;

function createState(overrides = {}) {
  const settings = createDefaultSettings();

  return {
    activeSession: createInitialSession(settings),
    backgroundNotice: '',
    focusHistory: [],
    historyTagEditEntryId: '',
    idleStartedAt: null,
    isNtfyTesting: false,
    lastCompletionKey: '',
    lastFocusMinuteReminderKey: '',
    lastIdleReminderAt: Date.now(),
    manualPipRequested: false,
    notificationNotice: '',
    ntfyNotice: 'old-value',
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

describe('root settings handlers', () => {
  beforeEach(() => {
    class FakeHTMLElement {
      constructor() {
        this.checked = false;
        this.dataset = {};
        this.value = '';
      }

      matches() {
        return false;
      }
    }

    class FakeHTMLInputElement extends FakeHTMLElement {}

    globalThis.HTMLElement = FakeHTMLElement;
    globalThis.HTMLInputElement = FakeHTMLInputElement;
  });

  afterEach(() => {
    globalThis.HTMLElement = originalHTMLElement;
    globalThis.HTMLInputElement = originalHTMLInputElement;
    vi.restoreAllMocks();
  });

  it('applies template duration and repeat-count changes with idle session sync', () => {
    const { deps, spies, state } = createDeps();
    const { handleRootChange } = createRootSettingsHandlers(deps);

    const durationInput = new HTMLElement();
    durationInput.dataset.templateDuration = 'work';
    durationInput.value = '40';
    durationInput.matches = (selector) => selector === '[data-template-duration]';

    handleRootChange({ target: durationInput });

    expect(state.settings.templateDurations.work).toBe(40 * 60 * 1000);
    expect(spies.persistSettings).toHaveBeenCalledTimes(1);
    expect(spies.commitSession).toHaveBeenCalledTimes(1);

    const repeatInput = new HTMLElement();
    repeatInput.value = '7';
    repeatInput.matches = (selector) => selector === '[data-repeat-count]';

    handleRootChange({ target: repeatInput });

    expect(state.settings.repeatCount).toBe(7);
    expect(spies.persistSettings).toHaveBeenCalledTimes(2);
    expect(spies.commitSession).toHaveBeenCalledTimes(2);
  });

  it('applies alert and ntfy URL mutations', () => {
    const { deps, spies, state } = createDeps();
    const { handleRootChange } = createRootSettingsHandlers(deps);

    const alertInput = new HTMLInputElement();
    alertInput.dataset.alertSetting = 'soundEnabled';
    alertInput.checked = false;
    alertInput.matches = (selector) => selector === '[data-alert-setting]';

    handleRootChange({ target: alertInput });

    expect(state.settings.alertSettings.soundEnabled).toBe(false);

    const ntfyInput = new HTMLInputElement();
    ntfyInput.value = 'https://ntfy.sh/my-timer';
    ntfyInput.matches = (selector) => selector === '[data-ntfy-publish-url]';

    handleRootChange({ target: ntfyInput });

    expect(state.settings.ntfyPublishUrl).toBe('https://ntfy.sh/my-timer');
    expect(state.ntfyNotice).toBe('');
    expect(spies.persistSettings).toHaveBeenCalledTimes(2);
    expect(spies.renderApp).toHaveBeenCalledTimes(2);
  });

  it('applies boolean setting toggles and syncs idle reminder state to worker', () => {
    const { deps, spies, state } = createDeps();
    const { handleRootChange } = createRootSettingsHandlers(deps);

    const autoStartInput = new HTMLInputElement();
    autoStartInput.dataset.settingToggle = 'autoStartNextStep';
    autoStartInput.checked = true;
    autoStartInput.matches = (selector) => selector === '[data-setting-toggle]';

    handleRootChange({ target: autoStartInput });
    expect(state.settings.autoStartNextStep).toBe(true);

    const pipTickInput = new HTMLInputElement();
    pipTickInput.dataset.settingToggle = 'pipClockTickEvery10s';
    pipTickInput.checked = true;
    pipTickInput.matches = (selector) => selector === '[data-setting-toggle]';

    handleRootChange({ target: pipTickInput });
    expect(state.settings.pipClockTickEvery10s).toBe(true);

    const idleReminderInput = new HTMLInputElement();
    idleReminderInput.dataset.settingToggle = 'idleReminderEnabled';
    idleReminderInput.checked = false;
    idleReminderInput.matches = (selector) => selector === '[data-setting-toggle]';

    handleRootChange({ target: idleReminderInput });

    expect(state.settings.idleReminderEnabled).toBe(false);
    expect(spies.postWorkerAction).toHaveBeenCalledWith(WORKER_ACTIONS.SET_IDLE_REMINDER, {
      enabled: false
    });
    expect(spies.persistSettings).toHaveBeenCalledTimes(3);
    expect(spies.renderApp).toHaveBeenCalledTimes(3);
  });

  it('keeps invalid or non-matching input events as no-ops', () => {
    const { deps, spies, state } = createDeps();
    const { handleRootChange } = createRootSettingsHandlers(deps);

    const previousSettings = JSON.parse(JSON.stringify(state.settings));

    handleRootChange({
      target: {
        matches() {
          return false;
        }
      }
    });

    const unknownToggleInput = new HTMLInputElement();
    unknownToggleInput.dataset.settingToggle = 'unknownToggle';
    unknownToggleInput.checked = true;
    unknownToggleInput.matches = (selector) => selector === '[data-setting-toggle]';

    handleRootChange({ target: unknownToggleInput });

    const wrongAlertElement = new HTMLElement();
    wrongAlertElement.dataset.alertSetting = 'soundEnabled';
    wrongAlertElement.checked = true;
    wrongAlertElement.matches = (selector) => selector === '[data-alert-setting]';

    handleRootChange({ target: wrongAlertElement });

    const wrongNtfyElement = new HTMLElement();
    wrongNtfyElement.value = 'https://ntfy.sh/my-timer';
    wrongNtfyElement.matches = (selector) => selector === '[data-ntfy-publish-url]';

    handleRootChange({ target: wrongNtfyElement });

    expect(state.settings).toEqual(previousSettings);
    expect(spies.persistSettings).not.toHaveBeenCalled();
    expect(spies.renderApp).not.toHaveBeenCalled();
    expect(spies.postWorkerAction).not.toHaveBeenCalled();
  });
});
