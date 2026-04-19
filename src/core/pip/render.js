import { PIP_STYLES } from './constants.js';
import { escapeHtml, getActionForStatus } from './model.js';

export function renderInWindow(targetWindow, model, onAction) {
  const documentRef = targetWindow.document;

  if (!documentRef?.body) {
    return;
  }

  const action = getActionForStatus(model.status);

  documentRef.title = `${model.clock} · ${model.stepLabel}`;
  documentRef.body.innerHTML = `
    <style>${PIP_STYLES}</style>
    <main
      class="pip-card"
      aria-label="Mini timer window"
      style="--pip-progress-fill:${escapeHtml(model.accent)};--pip-progress-track:${escapeHtml(model.progressTrack)};"
    >
      <p class="pip-header">
        <span class="pip-step">${escapeHtml(model.stepLabel)}</span>
        <span class="pip-divider" aria-hidden="true">·</span>
        <span class="pip-clock">${escapeHtml(model.clock)}</span>
      </p>
      <div class="pip-progress" aria-hidden="true">
        <span class="pip-progress__fill" style="width:${model.progressPercent}%"></span>
      </div>
      <button
        class="pip-action"
        data-pip-action
        type="button"
        ${action.code ? '' : 'disabled'}
      >
        ${action.label}
      </button>
    </main>
  `;

  const actionButton = documentRef.body.querySelector?.('[data-pip-action]');

  if (!actionButton || !action.code) {
    return;
  }

  actionButton.addEventListener?.('click', () => {
    onAction(action.code);
  });
}
