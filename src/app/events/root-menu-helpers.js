const COLLAPSIBLE_MENU_SELECTOR = '.overflow-actions[open], .history-edit-menu[open]';
const OVERFLOW_MENU_SELECTOR = '.overflow-actions, .history-edit-menu';
const HISTORY_INTERACTIVE_SELECTOR = '.history-item, .history-backup-actions';

export function isInsideOverflowMenu(target) {
  return Boolean(target?.closest?.(OVERFLOW_MENU_SELECTOR));
}

export function isInsideHistoryItem(target) {
  return Boolean(target?.closest?.(HISTORY_INTERACTIVE_SELECTOR));
}

export function closeAllCollapsibleMenus(root) {
  if (typeof root.querySelectorAll !== 'function') {
    return;
  }

  root.querySelectorAll(COLLAPSIBLE_MENU_SELECTOR).forEach((menu) => {
    menu.open = false;
  });
}

export function closeActiveHistoryEditors(state) {
  if (!state.historyTagEditEntryId && !state.historyNoteEditEntryId) {
    return false;
  }

  state.historyTagEditEntryId = '';
  state.historyNoteEditEntryId = '';
  return true;
}
