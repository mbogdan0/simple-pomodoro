function formatFocusDuration(durationMs) {
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return `${minutes} min`;
}

function formatCompletedAt(completedAt) {
  return new Date(completedAt).toLocaleString();
}

function renderHistoryItem(entry) {
  const date = new Date(entry.completedAt);

  return `
    <li class="history-item">
      <div class="history-item-meta">
        <time class="history-item-date" datetime="${date.toISOString()}">${formatCompletedAt(entry.completedAt)}</time>
        <p class="history-item-duration">${formatFocusDuration(entry.durationMs)}</p>
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
