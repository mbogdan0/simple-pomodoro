import { ROOT_ACTIONS } from '../app/events/root-contracts.js';
import { escapeHtml } from '../core/focus-note.js';

function renderModalAction({ action, label, primary = false, subtle = false }) {
  return `
    <button
      class="modal-action ${primary ? 'modal-action--primary' : ''} ${subtle ? 'modal-action--subtle' : ''}"
      data-action="${action}"
      ${primary ? 'data-modal-initial-focus' : ''}
      type="button"
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function renderModalShell({ actions, body, title }) {
  return `
    <div class="modal-layer" data-modal-layer>
      <button
        class="modal-backdrop"
        data-action="${ROOT_ACTIONS.CANCEL_MODAL}"
        type="button"
        aria-label="Close dialog"
      ></button>
      <section
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header class="modal-header">
          <h2 id="modal-title">${escapeHtml(title)}</h2>
        </header>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          ${actions.map(renderModalAction).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderFocusSaveModal(timerModel) {
  return renderModalShell({
    title: 'Save focus time',
    body: `
      <p>Choose what to write to focus history before the break starts.</p>
      <dl class="modal-duration-grid">
        <div>
          <dt>Actual</dt>
          <dd data-live-focus-save-actual>${escapeHtml(timerModel.focusSaveActualText)}</dd>
        </div>
        <div>
          <dt>Planned</dt>
          <dd>${escapeHtml(timerModel.focusSavePlannedText)}</dd>
        </div>
      </dl>
    `,
    actions: [
      { action: ROOT_ACTIONS.SAVE_FOCUS_ACTUAL, label: 'Save actual', primary: true },
      { action: ROOT_ACTIONS.SAVE_FOCUS_PLANNED, label: 'Save planned' },
      { action: ROOT_ACTIONS.SKIP_FOCUS_HISTORY, label: 'Skip history' },
      { action: ROOT_ACTIONS.CANCEL_MODAL, label: 'Cancel', subtle: true }
    ]
  });
}

function renderResetRunModal() {
  return renderModalShell({
    title: 'Reset current run?',
    body: '<p>This returns the timer to the first Focus step and clears the current note draft.</p>',
    actions: [
      { action: ROOT_ACTIONS.CONFIRM_RESET_RUN, label: 'Reset current run', primary: true },
      { action: ROOT_ACTIONS.CANCEL_MODAL, label: 'Cancel', subtle: true }
    ]
  });
}

function renderClearHistoryEntryModal() {
  return renderModalShell({
    title: 'Clear history entry?',
    body: '<p>This removes the selected focus history entry.</p>',
    actions: [
      { action: ROOT_ACTIONS.CONFIRM_CLEAR_HISTORY_ENTRY, label: 'Clear entry', primary: true },
      { action: ROOT_ACTIONS.CANCEL_MODAL, label: 'Cancel', subtle: true }
    ]
  });
}

function renderStaleSessionModal() {
  return renderModalShell({
    title: 'Start a new session?',
    body: '<p>The previous timer state is over an hour old. Reset it before continuing.</p>',
    actions: [
      {
        action: ROOT_ACTIONS.CONFIRM_STALE_SESSION_RESET,
        label: 'Start new session',
        primary: true
      },
      { action: ROOT_ACTIONS.CANCEL_MODAL, label: 'Keep previous session', subtle: true }
    ]
  });
}

export function renderAppModal(modal, timerModel) {
  if (!modal) {
    return '';
  }

  if (modal.type === 'focus-save') {
    return renderFocusSaveModal(timerModel);
  }

  if (modal.type === 'reset-run') {
    return renderResetRunModal();
  }

  if (modal.type === 'clear-history-entry') {
    return renderClearHistoryEntryModal();
  }

  if (modal.type === 'stale-session') {
    return renderStaleSessionModal();
  }

  return '';
}
