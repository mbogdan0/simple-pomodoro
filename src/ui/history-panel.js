import { FOCUS_TAG_LABELS, FOCUS_TAGS } from '../core/constants.js';
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

function resolveFocusTag(value) {
  return FOCUS_TAG_LABELS[value] ? value : 'none';
}

function renderHistoryTagOptions(entryId, activeTag) {
  return `
    <div class="history-tag-editor history-tag-editor--editing" aria-label="Edit focus tag" role="group">
      ${FOCUS_TAGS.map((tag) => {
        const isActive = tag === activeTag;

        return `
          <button
            class="history-tag history-tag--${tag} history-tag-option ${isActive ? 'is-active' : ''}"
            data-action="set-history-entry-focus-tag"
            data-entry-id="${entryId}"
            data-focus-tag="${tag}"
            aria-pressed="${isActive ? 'true' : 'false'}"
            type="button"
          >
            ${FOCUS_TAG_LABELS[tag]}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderHistoryTagReadOnly(entryId, focusTag) {
  return `
    <div class="history-tag-editor">
      <span class="history-tag history-tag--${focusTag}">${FOCUS_TAG_LABELS[focusTag]}</span>
      <button
        class="history-tag-edit-button"
        data-action="toggle-history-entry-tag-edit"
        data-entry-id="${entryId}"
        type="button"
      >
        Edit
      </button>
    </div>
  `;
}

function renderHistoryItem(entry, historyTagEditEntryId = '') {
  const date = new Date(entry.completedAt);
  const focusTag = resolveFocusTag(entry.focusTag);
  const isEditingTag = entry.id === historyTagEditEntryId;

  return `
    <li class="history-item">
      <div class="history-item-meta">
        <time class="history-item-date" datetime="${date.toISOString()}">${formatCompletedAt(entry.completedAt)}</time>
        <div class="history-item-details">
          <p class="history-item-duration">${formatFocusDuration(entry.durationMs)}</p>
          ${
            isEditingTag
              ? renderHistoryTagOptions(entry.id, focusTag)
              : renderHistoryTagReadOnly(entry.id, focusTag)
          }
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

function renderHistoryDayGroup(group, historyTagEditEntryId = '') {
  return `
    <li class="history-day-group">
      <header class="history-day-header">
        <h3 class="history-day-title">${group.dayLabel}</h3>
        <p class="history-day-total">${formatDailyFocusTotal(group.totalDurationMs)}</p>
      </header>
      <ul class="history-day-list">
        ${group.entries.map((entry) => renderHistoryItem(entry, historyTagEditEntryId)).join('')}
      </ul>
    </li>
  `;
}

export function renderHistoryPanel(historyEntries = [], historyTagEditEntryId = '') {
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
        ${groupHistoryEntriesByDay(historyEntries)
          .map((group) => renderHistoryDayGroup(group, historyTagEditEntryId))
          .join('')}
      </ul>
    </section>
  `;
}
