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

describe('settings panel', () => {
  it('renders ntfy test button disabled when ntfy URL is empty', () => {
    const html = renderSettingsPanel(createModel());

    expect(html).toContain('data-action="test-ntfy"');
    expect(html).toContain('data-ntfy-publish-url');
    expect(html).toMatch(/data-action="test-ntfy"[\s\S]*disabled/);
  });

  it('renders ntfy test button enabled when ntfy URL is set', () => {
    const html = renderSettingsPanel(
      createModel({
        settings: {
          ...createDefaultSettings(),
          ntfyPublishUrl: 'https://ntfy.sh/fizjuz-bowFek-kofhi2'
        }
      })
    );

    expect(html).toContain('data-action="test-ntfy"');
    expect(html).not.toMatch(/data-action="test-ntfy"[\s\S]*disabled/);
  });

  it('renders inline ntfy docs link and dedicated ntfy notice area', () => {
    const html = renderSettingsPanel(
      createModel({
        ntfyNotice: 'ntfy test push was sent.'
      })
    );

    expect(html).toContain('Send HTTP POST on focus/break completion');
    expect(html).toContain('https://docs.ntfy.sh/publish/');
    expect(html).toContain('ntfy test push was sent.');
  });

  it('renders ntfy test button in loading state', () => {
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
    expect(html).toContain('inline-spinner');
    expect(html).toMatch(/data-action="test-ntfy"[\s\S]*disabled/);
  });
});
