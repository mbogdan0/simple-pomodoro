import { FOCUS_TAG_LABELS, FOCUS_TAGS } from '../core/constants.js';
import { MAX_FOCUS_NOTE_LENGTH, escapeHtml } from '../core/focus-note.js';
import { formatClock } from '../core/format.js';
import { ROOT_ACTIONS } from '../app/events/root-contracts.js';

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
            data-action="${ROOT_ACTIONS.SET_HISTORY_ENTRY_FOCUS_TAG}"
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

function renderHistoryTagReadOnly(focusTag) {
  return `
    <div class="history-tag-editor">
      <span class="history-tag history-tag--${focusTag}">${FOCUS_TAG_LABELS[focusTag]}</span>
    </div>
  `;
}

function renderHistoryNote(entryId, focusNote, isEditingNote) {
  return `
    <div class="history-note-editor">
      ${
        isEditingNote
          ? `
            <label class="history-note-editor__field">
              <span class="sr-only">Edit focus note</span>
              <input
                class="history-note-input"
                data-history-entry-focus-note-input
                data-entry-id="${entryId}"
                maxlength="${MAX_FOCUS_NOTE_LENGTH}"
                placeholder="Add a short note"
                type="text"
                value="${escapeHtml(focusNote)}"
              >
            </label>
          `
          : focusNote
            ? `<p class="history-item-note" title="${escapeHtml(focusNote)}">${escapeHtml(focusNote)}</p>`
            : ''
      }
      ${
        isEditingNote
          ? `
            <button
              class="history-note-edit-button"
              data-action="${ROOT_ACTIONS.TOGGLE_HISTORY_ENTRY_NOTE_EDIT}"
              data-entry-id="${entryId}"
              type="button"
            >
              Done
            </button>
          `
          : ''
      }
    </div>
  `;
}

function renderHistoryEditMenu(entryId) {
  return `
    <details class="history-edit-menu">
      <summary
        class="ghost-button history-edit-menu__trigger"
        aria-label="Edit history entry"
        title="Edit history entry"
      >
        Edit
      </summary>
      <div class="history-edit-menu__list" aria-label="History entry edit options" role="menu">
        <button
          class="history-edit-menu__item"
          data-action="${ROOT_ACTIONS.TOGGLE_HISTORY_ENTRY_NOTE_EDIT}"
          data-entry-id="${entryId}"
          role="menuitem"
          type="button"
        >
          Edit note
        </button>
        <button
          class="history-edit-menu__item"
          data-action="${ROOT_ACTIONS.TOGGLE_HISTORY_ENTRY_TAG_EDIT}"
          data-entry-id="${entryId}"
          role="menuitem"
          type="button"
        >
          Edit tag
        </button>
      </div>
    </details>
  `;
}

function renderHistoryActionRow(entryId, isEditingTagOrNote) {
  return `
    <div class="history-item-actions">
      ${isEditingTagOrNote ? '' : renderHistoryEditMenu(entryId)}
      <button
        class="ghost-button"
        data-action="${ROOT_ACTIONS.CLEAR_HISTORY_ENTRY}"
        data-entry-id="${entryId}"
        type="button"
      >
        Clear
      </button>
    </div>
  `;
}

function renderHistoryItem(entry, historyTagEditEntryId = '', historyNoteEditEntryId = '') {
  const date = new Date(entry.completedAt);
  const focusTag = resolveFocusTag(entry.focusTag);
  const focusNote = typeof entry.focusNote === 'string' ? entry.focusNote : '';
  const isEditingTag = entry.id === historyTagEditEntryId;
  const isEditingNote = entry.id === historyNoteEditEntryId;
  const isEditingAny = isEditingTag || isEditingNote;

  return `
    <li class="history-item">
      <div class="history-item-meta">
        <time class="history-item-date" datetime="${date.toISOString()}">${formatCompletedAt(entry.completedAt)}</time>
        <div class="history-item-details">
          <p class="history-item-duration">${formatFocusDuration(entry.durationMs)}</p>
          ${renderHistoryNote(entry.id, focusNote, isEditingNote)}
          ${
            isEditingTag
              ? renderHistoryTagOptions(entry.id, focusTag)
              : renderHistoryTagReadOnly(focusTag)
          }
        </div>
      </div>
      ${renderHistoryActionRow(entry.id, isEditingAny)}
    </li>
  `;
}

function renderHistoryDayGroup(group, historyTagEditEntryId = '', historyNoteEditEntryId = '') {
  return `
    <li class="history-day-group">
      <header class="history-day-header">
        <h3 class="history-day-title">${group.dayLabel}</h3>
        <p class="history-day-total">${formatDailyFocusTotal(group.totalDurationMs)}</p>
      </header>
      <ul class="history-day-list">
        ${group.entries
          .map((entry) => renderHistoryItem(entry, historyTagEditEntryId, historyNoteEditEntryId))
          .join('')}
      </ul>
    </li>
  `;
}

export function renderHistoryPanel(
  historyEntries = [],
  historyTagEditEntryId = '',
  historyNoteEditEntryId = ''
) {
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
          .map((group) =>
            renderHistoryDayGroup(group, historyTagEditEntryId, historyNoteEditEntryId)
          )
          .join('')}
      </ul>
    </section>
  `;
}
