import { FOCUS_TAG_LABELS } from '../core/constants.js';
import { formatClock } from '../core/format.js';

const HISTORY_DAY_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric'
});

function formatFocusDuration(durationMs) {
  return formatClock(durationMs);
}

function formatCompletedAt(completedAt) {
  return new Date(completedAt).toLocaleString();
}

function createLocalDayKey(completedAt) {
  const date = new Date(completedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHistoryDayLabel(completedAt) {
  return HISTORY_DAY_LABEL_FORMATTER.format(new Date(completedAt));
}

function formatDailyFocusTotal(totalDurationMs) {
  const totalMinutes = Math.max(0, Math.round(totalDurationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m focus`;
  }

  if (hours > 0) {
    return `${hours}h focus`;
  }

  return `${minutes}m focus`;
}

function groupHistoryEntriesByDay(historyEntries = []) {
  const groups = [];
  const groupsByDayKey = new Map();

  historyEntries.forEach((entry) => {
    const dayKey = createLocalDayKey(entry.completedAt);
    let group = groupsByDayKey.get(dayKey);

    if (!group) {
      group = {
        dayKey,
        dayLabel: formatHistoryDayLabel(entry.completedAt),
        entries: [],
        totalDurationMs: 0
      };
      groupsByDayKey.set(dayKey, group);
      groups.push(group);
    }

    group.entries.push(entry);
    group.totalDurationMs += Number.isFinite(entry.durationMs) ? entry.durationMs : 0;
  });

  return groups;
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

function renderHistoryDayGroup(group) {
  return `
    <li class="history-day-group">
      <header class="history-day-header">
        <h3 class="history-day-title">${group.dayLabel}</h3>
        <p class="history-day-total">${formatDailyFocusTotal(group.totalDurationMs)}</p>
      </header>
      <ul class="history-day-list">
        ${group.entries.map((entry) => renderHistoryItem(entry)).join('')}
      </ul>
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
        ${groupHistoryEntriesByDay(historyEntries).map((group) => renderHistoryDayGroup(group)).join('')}
      </ul>
    </section>
  `;
}
