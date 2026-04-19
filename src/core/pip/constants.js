export const PIP_WINDOW_HEIGHT = 112;
export const PIP_WINDOW_WIDTH = 212;

export const PIP_STYLES = `
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

  .pip-header {
    align-items: center;
    display: flex;
    gap: 4px;
    margin: 0;
    min-width: 0;
  }

  .pip-step {
    color: var(--pip-muted);
    font-size: 9px;
    letter-spacing: 0.06em;
    line-height: 1;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: uppercase;
  }

  .pip-divider {
    color: var(--pip-muted);
    font-size: 10px;
    line-height: 1;
  }

  .pip-clock {
    font-family: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 22px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: 1;
    margin: 0 0 0 auto;
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
    justify-self: start;
    margin-top: 8px;
    padding: 6px 12px;
  }

  .pip-action:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @media (max-height: 104px) {
    body {
      padding: 5px;
    }

    .pip-card {
      gap: 5px;
      padding: 7px;
    }

    .pip-clock {
      font-size: 20px;
    }
  }

  @media (max-height: 92px) {
    .pip-action {
      display: none;
    }
  }

  @media (max-width: 200px) {
    .pip-step {
      font-size: 8.5px;
    }

    .pip-clock {
      font-size: 20px;
    }
  }
`;
