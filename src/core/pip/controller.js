import { PIP_WINDOW_HEIGHT, PIP_WINDOW_WIDTH } from './constants.js';
import { normalizeModel } from './model.js';
import { renderInWindow } from './render.js';

export function isPictureInPictureSupported(targetWindow = globalThis.window) {
  return Boolean(
    targetWindow &&
      targetWindow.documentPictureInPicture &&
      typeof targetWindow.documentPictureInPicture.requestWindow === 'function'
  );
}

export function createTimerPipController(options = {}) {
  const hostWindow = options.hostWindow ?? globalThis.window;
  const onAction = typeof options.onAction === 'function' ? options.onAction : () => {};
  const onWindowClosed =
    typeof options.onWindowClosed === 'function' ? options.onWindowClosed : () => {};
  let closeRequestedByApp = false;
  let latestModel = normalizeModel();
  let openRequest = null;
  let pageHideHandler = null;
  let pipWindow = null;

  function detachWindow() {
    if (pipWindow && pageHideHandler) {
      pipWindow.removeEventListener?.('pagehide', pageHideHandler);
    }

    pipWindow = null;
    pageHideHandler = null;
    closeRequestedByApp = false;
  }

  function attachWindow(nextWindow) {
    if (!nextWindow || nextWindow.closed) {
      return;
    }

    if (pipWindow === nextWindow) {
      return;
    }

    detachWindow();
    pipWindow = nextWindow;
    closeRequestedByApp = false;
    pageHideHandler = () => {
      const wasManualClose = !closeRequestedByApp;
      detachWindow();
      onWindowClosed(wasManualClose ? 'user' : 'app');
    };
    pipWindow.addEventListener?.('pagehide', pageHideHandler);
  }

  function resolveWindow() {
    if (pipWindow && !pipWindow.closed) {
      return pipWindow;
    }

    const current = hostWindow?.documentPictureInPicture?.window;

    if (current && !current.closed) {
      attachWindow(current);
      return current;
    }

    detachWindow();
    return null;
  }

  async function openFromUserGesture() {
    if (!isPictureInPictureSupported(hostWindow)) {
      return false;
    }

    const currentWindow = resolveWindow();

    if (currentWindow) {
      renderInWindow(currentWindow, latestModel, onAction);
      return true;
    }

    if (openRequest) {
      return openRequest;
    }

    openRequest = hostWindow.documentPictureInPicture
      .requestWindow({
        height: PIP_WINDOW_HEIGHT,
        width: PIP_WINDOW_WIDTH
      })
      .then((nextWindow) => {
        attachWindow(nextWindow);
        const active = resolveWindow();

        if (!active) {
          return false;
        }

        renderInWindow(active, latestModel, onAction);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        openRequest = null;
      });

    return openRequest;
  }

  function close() {
    const currentWindow = resolveWindow();

    if (!currentWindow) {
      return;
    }

    closeRequestedByApp = true;

    try {
      currentWindow.close?.();
    } catch {
      // Ignore close errors (browser controls this window).
    }

    detachWindow();
  }

  function update(model = {}) {
    latestModel = normalizeModel(model);
    const currentWindow = resolveWindow();

    if (!currentWindow) {
      return false;
    }

    renderInWindow(currentWindow, latestModel, onAction);
    return true;
  }

  return {
    close,
    isOpen: () => Boolean(resolveWindow()),
    isSupported: () => isPictureInPictureSupported(hostWindow),
    openFromUserGesture,
    update
  };
}
