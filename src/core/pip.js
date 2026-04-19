const PIP_WINDOW_HEIGHT = 124;
const PIP_WINDOW_WIDTH = 224;

const PIP_STYLES = `
  :root {
    color-scheme: light;
    --pip-bg: #fff;
    --pip-fg: #1f2623;
    --pip-muted: #6b736d;
    --pip-border: #ddd6cc;
    --pip-progress-track: #ede7de;
    --pip-progress-fill: #2f8c73;
    --pip-button-bg: #1f2623;
    --pip-button-fg: #fff;
  }

  * {
    box-sizing: border-box;
  }

  body {
    background: var(--pip-bg);
    color: var(--pip-fg);
    font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", "Noto Sans", Arial, sans-serif;
    margin: 0;
    min-height: 100vh;
    padding: 6px;
  }

  .pip-card {
    border: 1px solid var(--pip-border);
    border-radius: 10px;
    display: grid;
    gap: 6px;
    padding: 8px;
  }

  .pip-step {
    color: var(--pip-muted);
    font-size: 9px;
    letter-spacing: 0.06em;
    line-height: 1.2;
    margin: 0;
    text-transform: uppercase;
  }

  .pip-clock {
    font-family: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 26px;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    line-height: 1;
    margin: 0;
  }

  .pip-progress {
    background: var(--pip-progress-track);
    border-radius: 999px;
    height: 4px;
    overflow: hidden;
    width: 100%;
  }

  .pip-progress__fill {
    background: var(--pip-progress-fill);
    border-radius: inherit;
    display: block;
    height: 100%;
  }

  .pip-action {
    background: var(--pip-button-bg);
    border: 1px solid transparent;
    border-radius: 999px;
    color: var(--pip-button-fg);
    cursor: pointer;
    font: inherit;
    font-size: 10px;
    line-height: 1;
    padding: 3px 7px;
  }

  .pip-action:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @media (max-height: 116px) {
    body {
      padding: 5px;
    }

    .pip-card {
      gap: 4px;
      padding: 6px;
    }

    .pip-step {
      display: none;
    }
  }

  @media (max-height: 92px) {
    .pip-action {
      display: none;
    }
  }

  @media (max-width: 210px) {
    .pip-clock {
      font-size: 22px;
    }
  }
`;

function clampProgress(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function sanitizeText(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return fallback;
}

function sanitizeColor(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeModel(model = {}) {
  const status = ['running', 'paused'].includes(model.status) ? model.status : 'idle';

  return {
    accent: sanitizeColor(model.accent, '#2f8c73'),
    clock: sanitizeText(model.clock, '00:00'),
    progressTrack: sanitizeColor(model.progressTrack, '#ede7de'),
    progressPercent: clampProgress(model.progressPercent),
    status,
    stepLabel: sanitizeText(model.stepLabel, 'Timer')
  };
}

function getActionForStatus(status) {
  if (status === 'running') {
    return {
      code: 'PAUSE',
      label: 'Pause'
    };
  }

  if (status === 'paused') {
    return {
      code: 'RESUME',
      label: 'Resume'
    };
  }

  return {
    code: 'START',
    label: 'Start'
  };
}

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

  function renderInWindow(targetWindow, model) {
    const documentRef = targetWindow.document;

    if (!documentRef?.body) {
      return;
    }

    const action = getActionForStatus(model.status);

    documentRef.title = `${model.clock} · ${model.stepLabel}`;
    documentRef.body.innerHTML = `
      <style>${PIP_STYLES}</style>
      <main
        class="pip-card"
        aria-label="Mini timer window"
        style="--pip-progress-fill:${escapeHtml(model.accent)};--pip-progress-track:${escapeHtml(model.progressTrack)};"
      >
        <p class="pip-step">${escapeHtml(model.stepLabel)}</p>
        <p class="pip-clock">${escapeHtml(model.clock)}</p>
        <div class="pip-progress" aria-hidden="true">
          <span class="pip-progress__fill" style="width:${model.progressPercent}%"></span>
        </div>
        <button
          class="pip-action"
          data-pip-action
          type="button"
          ${action.code ? '' : 'disabled'}
        >
          ${action.label}
        </button>
      </main>
    `;

    const actionButton = documentRef.body.querySelector?.('[data-pip-action]');

    if (!actionButton || !action.code) {
      return;
    }

    actionButton.addEventListener?.('click', () => {
      onAction(action.code);
    });
  }

  async function openFromUserGesture() {
    if (!isPictureInPictureSupported(hostWindow)) {
      return false;
    }

    const currentWindow = resolveWindow();

    if (currentWindow) {
      renderInWindow(currentWindow, latestModel);
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

        renderInWindow(active, latestModel);
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

    renderInWindow(currentWindow, latestModel);
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
