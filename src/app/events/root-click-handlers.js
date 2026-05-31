// @ts-check

import {
  closeActiveHistoryEditors,
  closeAllCollapsibleMenus,
  isInsideHistoryItem,
  isInsideOverflowMenu
} from './root-menu-helpers.js';

export function createRootClickHandlers({
  actionHandlers,
  playUiActionTone,
  renderApp,
  root,
  state
}) {
  function handleRootClick(event) {
    const target = event?.target;

    if (!isInsideOverflowMenu(target)) {
      closeAllCollapsibleMenus(root);
    }

    if (target?.closest?.('.action-button--overflow')) {
      playUiActionTone();
    }

    const button = target?.closest?.('[data-action]');

    if (!button) {
      return;
    }

    const action = button?.dataset?.action;

    if (!action) {
      return;
    }

    const actionHandler = actionHandlers[action];

    if (typeof actionHandler === 'function') {
      actionHandler(button);
    }
  }

  function handleDocumentClick(event) {
    const target = event?.target;

    if (isInsideOverflowMenu(target)) {
      return;
    }

    closeAllCollapsibleMenus(root);

    if (isInsideHistoryItem(target)) {
      return;
    }

    if (closeActiveHistoryEditors(state)) {
      renderApp();
    }
  }

  return {
    handleDocumentClick,
    handleRootClick
  };
}
