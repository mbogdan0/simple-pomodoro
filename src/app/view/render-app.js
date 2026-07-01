import { TAB_LABELS } from '../../core/constants.js';
import { formatNotificationPermissionLabel } from '../../core/format.js';
import { renderHistoryPanel } from '../../ui/history-panel.js';
import { renderAppModal } from '../../ui/modal.js';
import { renderSettingsPanel } from '../../ui/settings-panel.js';
import { renderTimerPanel } from '../../ui/timer-panel.js';
import { ROOT_ACTIONS, ROOT_TABS } from '../events/root-contracts.js';
import { collectLiveRefs, patchLiveTimerDom } from './live-timer-dom.js';
import { createPageChromeUpdater } from './page-chrome.js';
import { createTimerModel } from './timer-model.js';

export function createAppRenderer({ root, state, pipController, getNotificationSupportModel }) {
  const { updatePageChrome } = createPageChromeUpdater({ state });
  let liveRefs = collectLiveRefs(root);
  let liveUpdateHooks = {
    maybeDispatchFocusMinuteReminder: () => {},
    maybeDispatchFocusOvertimeReminder: () => {},
    syncPictureInPicture: () => {}
  };

  function getTimerModel(now = Date.now()) {
    return createTimerModel({
      now,
      pipController,
      state
    });
  }

  function renderApp() {
    const activeTab = state.settings.lastOpenTab;
    const timerModel = getTimerModel();
    const notificationSupport = getNotificationSupportModel();
    const permissionLabel = formatNotificationPermissionLabel(notificationSupport.permissionState);

    root.innerHTML = `
      <main class="shell">
        <header class="app-header">
          <nav class="tabs" aria-label="Application navigation">
            ${Object.entries(TAB_LABELS)
              .map(
                ([tab, label]) => `
                  <button
                    class="tab-button ${activeTab === tab ? 'is-active' : ''}"
                    data-action="${ROOT_ACTIONS.SWITCH_TAB}"
                    data-tab="${tab}"
                    aria-current="${activeTab === tab ? 'page' : 'false'}"
                    aria-pressed="${activeTab === tab ? 'true' : 'false'}"
                    type="button"
                  >
                    ${label}
                  </button>
                `
              )
              .join('')}
          </nav>
        </header>

        <section class="panel-grid">
          ${activeTab === ROOT_TABS.TIMER ? renderTimerPanel(timerModel) : ''}
          ${
            activeTab === ROOT_TABS.SETTINGS
              ? renderSettingsPanel({
                  isNtfyTesting: state.isNtfyTesting,
                  notificationNotice: state.notificationNotice,
                  notificationPermissionLabel: permissionLabel,
                  notificationSupport,
                  ntfyNotice: state.ntfyNotice,
                  pipSupported: pipController.isSupported(),
                  sessionStatus: state.activeSession.status,
                  settings: state.settings
                })
              : ''
          }
          ${
            activeTab === ROOT_TABS.HISTORY
              ? renderHistoryPanel(
                  state.focusHistory,
                  state.historyTagEditEntryId,
                  state.historyNoteEditEntryId,
                  {
                    importNotice: state.historyImportNotice,
                    lastFocusHistoryExportedAt: state.lastFocusHistoryExportedAt
                  }
                )
              : ''
          }
        </section>
      </main>
      ${renderAppModal(state.modal, timerModel)}
    `;

    liveRefs = collectLiveRefs(root);
    updateTimerLiveRegion();
    updatePageChrome();
    root.querySelector('[data-modal-initial-focus]')?.focus?.();
  }

  function updateTimerLiveRegion(now = Date.now()) {
    const timerModel = getTimerModel(now);
    if (!liveRefs.clockElement && !liveRefs.statusElement) {
      liveRefs = collectLiveRefs(root);
    }

    patchLiveTimerDom(liveRefs, timerModel);
    liveUpdateHooks.syncPictureInPicture(timerModel, now);
    liveUpdateHooks.maybeDispatchFocusMinuteReminder(state.activeSession, now);
    liveUpdateHooks.maybeDispatchFocusOvertimeReminder(state.activeSession, now);
  }

  function setLiveUpdateHooks(nextHooks) {
    liveUpdateHooks = {
      ...liveUpdateHooks,
      ...nextHooks
    };
  }

  return {
    getTimerModel,
    renderApp,
    setLiveUpdateHooks,
    updatePageChrome,
    updateTimerLiveRegion
  };
}
