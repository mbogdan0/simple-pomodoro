import { STEP_TYPES, STEP_TYPE_LABELS } from '../core/constants.js';
import { formatMinutesValue } from '../core/format.js';

export function renderSettingsPanel({
  isNtfyTesting = false,
  notificationNotice = '',
  notificationPermissionLabel = 'Unavailable',
  notificationSupport = {},
  ntfyNotice = '',
  pipSupported = false,
  sessionStatus = 'idle',
  settings
}) {
  const resolvedNotificationSupport = {
    hasNotificationApi: Boolean(notificationSupport.hasNotificationApi),
    unsupported: Boolean(notificationSupport.unsupported)
  };
  const sessionLocked = ['running', 'paused'].includes(sessionStatus);
  const hasNtfyPublishUrl = Boolean(settings?.ntfyPublishUrl);

  return `
    <section class="panel settings-layout" id="panel-settings" aria-label="Settings panel" role="region">
      <div class="panel-section">
        <div class="panel-heading">
          <h2>Cycle settings</h2>
          ${sessionLocked ? '<p class="inline-note">Changes apply after reset or after starting a new cycle.</p>' : ''}
        </div>

        <div class="template-grid">
          ${STEP_TYPES.map(
            (type) => `
              <label class="template-card">
                <span>${STEP_TYPE_LABELS[type]}</span>
                <input
                  data-template-duration="${type}"
                  inputmode="numeric"
                  max="480"
                  min="1"
                  type="number"
                  value="${formatMinutesValue(settings.templateDurations[type])}"
                >
                <small>minutes</small>
              </label>
            `
          ).join('')}
          <label class="template-card">
            <span>Repeats</span>
            <input
              data-repeat-count
              inputmode="numeric"
              max="24"
              min="1"
              type="number"
              value="${settings.repeatCount}"
            >
            <small>focus sessions in one cycle</small>
          </label>
        </div>
        <label class="toggle-row">
          <span>Auto-start next step</span>
          <input
            ${settings.autoStartNextStep ? 'checked' : ''}
            data-setting-toggle="autoStartNextStep"
            type="checkbox"
          >
        </label>
      </div>

      ${
        pipSupported
          ? `
            <div class="panel-section">
              <div class="panel-heading">
                <h2>Mini window</h2>
              </div>

              <label class="toggle-row">
                <span>PiP clock updates every 10 seconds</span>
                <input
                  ${settings.pipClockTickEvery10s ? 'checked' : ''}
                  data-setting-toggle="pipClockTickEvery10s"
                  type="checkbox"
                >
              </label>
            </div>
          `
          : ''
      }

      <div class="panel-section">
        <div class="panel-heading">
          <h2>Alerts</h2>
        </div>

        <div class="alert-grid">
          <div class="permission-row">
            <span>Status</span>
            <strong>${notificationPermissionLabel}</strong>
          </div>
          <label class="toggle-row">
            <span>Sound</span>
            <input
              ${settings.alertSettings.soundEnabled ? 'checked' : ''}
              data-alert-setting="soundEnabled"
              type="checkbox"
            >
          </label>
          <label class="toggle-row">
            <span>Notifications</span>
            <input
              ${settings.alertSettings.notificationsEnabled ? 'checked' : ''}
              data-alert-setting="notificationsEnabled"
              type="checkbox"
            >
          </label>
          <div class="settings-actions">
            ${
              resolvedNotificationSupport.hasNotificationApi
                ? `
                  <button class="ghost-button" data-action="request-notification-permission" type="button">
                    Allow notifications
                  </button>
                `
                : ''
            }
            <button class="ghost-button" data-action="test-sound" type="button">
              Test sound
            </button>
            ${
              resolvedNotificationSupport.unsupported
                ? ''
                : `
                  <button class="ghost-button" data-action="test-notification" type="button">
                    Test notification
                  </button>
                `
            }
          </div>
          ${
            resolvedNotificationSupport.unsupported
              ? '<p class="notice-banner subtle">Notifications are not supported in this browser.</p>'
              : ''
          }
          ${
            notificationNotice
              ? `<p class="inline-note">${notificationNotice}</p>`
              : ''
          }
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-heading">
          <h2>ntfy.sh</h2>
        </div>

        <div class="alert-grid">
          <label class="template-card">
            <span>Publish URL</span>
            <input
              data-ntfy-publish-url
              placeholder="https://ntfy.sh/your-topic"
              type="url"
              value="${settings.ntfyPublishUrl}"
            >
            <small>
              Send HTTP POST on focus/break completion from this browser tab (tab must stay open).
              <a href="https://docs.ntfy.sh/publish/" rel="noopener noreferrer" target="_blank">Docs</a>.
            </small>
          </label>
          <div class="settings-actions">
            <button
              class="ghost-button"
              data-action="test-ntfy"
              type="button"
              aria-busy="${isNtfyTesting ? 'true' : 'false'}"
              ${hasNtfyPublishUrl && !isNtfyTesting ? '' : 'disabled'}
            >
              ${
                isNtfyTesting
                  ? '<span class="inline-spinner" aria-hidden="true"></span> Sending...'
                  : 'Test'
              }
            </button>
          </div>
          ${
            ntfyNotice
              ? `<p class="inline-note">${ntfyNotice}</p>`
              : ''
          }
        </div>
      </div>
    </section>
  `;
}
