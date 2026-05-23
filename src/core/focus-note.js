export const MAX_FOCUS_NOTE_LENGTH = 30;

export function normalizeFocusNote(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.slice(0, MAX_FOCUS_NOTE_LENGTH);
}

export function escapeHtml(value) {
  const resolved = typeof value === 'string' ? value : '';

  return resolved
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
