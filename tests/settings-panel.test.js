import { describe, expect, it } from 'vitest';

import { createDefaultSettings } from '../src/core/settings.js';
import { renderSettingsPanel } from '../src/ui/settings-panel.js';

function createModel(overrides = {}) {
  return {
    isNtfyTesting: false,
    notificationNotice: '',
    notificationPermissionLabel: 'Allowed',
    notificationSupport: {
      hasNotificationApi: true,
      unsupported: false
    },
    ntfyNotice: '',
    pipSupported: true,
    sessionStatus: 'idle',
    settings: createDefaultSettings(),
    ...overrides
  };
}

describe('settings panel behavior', () => {
  it('locks cycle-settings guidance while session is active', () => {
    const html = renderSettingsPanel(createModel({ sessionStatus: 'running' }));

    expect(html).toContain('Changes apply after reset or after starting a new cycle.');
    expect(html).toContain('data-template-duration="work"');
    expect(html).toContain('data-repeat-count');
  });

  it('hides notification permission action when notifications are already allowed', () => {
    const html = renderSettingsPanel(
      createModel({
        notificationSupport: {
          hasNotificationApi: true,
          permissionState: 'granted',
          unsupported: false
        }
      })
    );

    expect(html).not.toContain('data-action="request-notification-permission"');
    expect(html).not.toContain('Allow notifications');
  });

  it('shows notification permission action when notifications are not allowed yet', () => {
    const html = renderSettingsPanel(
      createModel({
        notificationSupport: {
          hasNotificationApi: true,
          permissionState: 'default',
          unsupported: false
        }
      })
    );

    expect(html).toContain('data-action="request-notification-permission"');
    expect(html).toContain('Allow notifications');
  });

  it('disables ntfy test action when publish URL is missing', () => {
    const html = renderSettingsPanel(
      createModel({
        settings: {
          ...createDefaultSettings(),
          ntfyPublishUrl: ''
        }
      })
    );

    expect(html).toContain('data-action="test-ntfy"');
    expect(html).toMatch(/data-action="test-ntfy"[\s\S]*disabled/);
  });

  it('enables ntfy test action when URL is valid and shows loading state', () => {
    const html = renderSettingsPanel(
      createModel({
        isNtfyTesting: true,
        settings: {
          ...createDefaultSettings(),
          ntfyPublishUrl: 'https://ntfy.sh/fizjuz-bowFek-kofhi2'
        }
      })
    );

    expect(html).toContain('data-action="test-ntfy"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Sending...');
  });
});
