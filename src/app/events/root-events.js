// @ts-check

import { createRootActionHandlers } from './root-action-handlers.js';
import { createRootClickHandlers } from './root-click-handlers.js';
import { createRootInputHandlers } from './root-input-handlers.js';
import { createRootSettingsHandlers } from './root-settings-handlers.js';

/**
 * @param {import('./root-event-types.js').RootEventDeps} deps
 */
export function createRootEvents(deps) {
  const { root } = deps;
  const { handlers: actionHandlers, playUiActionTone } = createRootActionHandlers(deps);
  const settingsHandlers = createRootSettingsHandlers(deps);
  const inputHandlers = createRootInputHandlers(deps);
  const clickHandlers = createRootClickHandlers({
    actionHandlers,
    playUiActionTone,
    renderApp: deps.renderApp,
    root: deps.root,
    state: deps.state
  });
  let isBound = false;

  function bindRootEvents() {
    if (isBound) {
      return;
    }

    root.addEventListener('click', clickHandlers.handleRootClick);
    root.addEventListener('change', settingsHandlers.handleRootChange);
    root.addEventListener('input', inputHandlers.handleRootInput);
    document.addEventListener('click', clickHandlers.handleDocumentClick);
    isBound = true;
  }

  function dispose() {
    if (!isBound) {
      return;
    }

    root.removeEventListener?.('click', clickHandlers.handleRootClick);
    root.removeEventListener?.('change', settingsHandlers.handleRootChange);
    root.removeEventListener?.('input', inputHandlers.handleRootInput);
    document.removeEventListener?.('click', clickHandlers.handleDocumentClick);
    isBound = false;
  }

  return {
    bindRootEvents,
    dispose,
    handleRootInput: inputHandlers.handleRootInput,
    handleRootChange: settingsHandlers.handleRootChange,
    handleRootClick: clickHandlers.handleRootClick
  };
}
