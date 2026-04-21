import { FOCUS_TAG_LABELS } from '../core/constants.js';
import { formatClock } from '../core/format.js';

function formatFocusDuration(durationMs) {
  return formatClock(durationMs);
}

function formatCompletedAt(completedAt) {
  return new Date(completedAt).toLocaleString();
}

function renderHistoryItem(entry) {
  const date = new Date(entry.completedAt);
  const requestedTag = typeof entry.focusTag === 'string' ? entry.focusTag : 'none';
  const focusTag = FOCUS_TAG_LABELS[requestedTag] ? requestedTag : 'none';
  const focusTagLabel = FOCUS_TAG_LABELS[focusTag];

  return `
    <li class="history-item">
      <div class="history-item-meta">
        <time class="history-item-date" datetime="${date.toISOString()}">${formatCompletedAt(entry.completedAt)}</time>
        <div class="history-item-details">
          <p class="history-item-duration">${formatFocusDuration(entry.durationMs)}</p>
          <span class="history-tag history-tag--${focusTag}">${focusTagLabel}</span>
        </div>
      </div>
      <button
        class="ghost-button"
        data-action="clear-history-entry"
        data-entry-id="${entry.id}"
        type="button"
      >
        Clear
      </button>
    </li>
  `;
}

export function renderHistoryPanel(historyEntries = []) {
  if (!historyEntries.length) {
    return `
      <section class="panel history-layout" id="panel-history" aria-label="History panel" role="region">
        <div class="panel-heading">
          <h2>Focus History</h2>
        </div>
        <p class="inline-note history-empty">No completed focus sessions yet.</p>
      </section>
    `;
  }

  return `
    <section class="panel history-layout" id="panel-history" aria-label="History panel" role="region">
      <div class="panel-heading">
        <h2>Focus History</h2>
      </div>
      <ul class="history-list">
        ${historyEntries.map((entry) => renderHistoryItem(entry)).join('')}
      </ul>
    </section>
  `;
}
