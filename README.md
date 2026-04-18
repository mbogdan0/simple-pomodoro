# Simple Pomodoro Timer

A lightweight Pomodoro timer web app with background-safe ticking, per-step alerts, and an offline-capable service worker.

## Features

- Step-based Pomodoro cycle: `Focus -> Short Break -> ... -> Long Break`
- Configurable durations for focus, short break, and long break steps
- Configurable repeat count for focus sessions per cycle
- Start, pause, resume, and reset controls
- Progress tracking for both current step and focus repeats
- Notification fallback logic (window notifications + service worker channel)
- Louder, longer completion tone at the end of every completed step
- Dynamic document title and generated favicon badge with live timer state
- Local persistence for settings and active session state

## Tech Stack

- Vanilla JavaScript (ES modules)
- CSS
- `esbuild` for bundling
- `vitest` for tests

## Getting Started

### Requirements

- Node.js 20+ (recommended)
- npm

### Install

```bash
npm ci
```

### Run checks

```bash
npm run check
```

This runs tests and then builds production assets.

### Build

```bash
npm run build
```

Build output goes to `dist/`.

### Test

```bash
npm test
```

## Available Scripts

- `npm run build`: bundle app, worker, and service worker into `dist/`
- `npm test`: run test suite with Vitest
- `npm run check`: run `test` and `build`

## Project Structure

- `src/main.js`: app bootstrap, state sync, UI events, alerts
- `src/worker.js`: timer worker for resilient background timing
- `src/service-worker.js`: notification deduplication + SW notification channel
- `src/core/*`: domain logic (session, settings, storage, formatting, alerts)
- `src/ui/timer-panel.js`: timer panel markup rendering
- `build.mjs`: production build pipeline
- `tests/*`: unit tests for core logic and rendering helpers

## Timer Behavior

- The app uses a scenario snapshot generated from your settings.
- A step is considered complete when its absolute end timestamp is reached.
- On completion, the app dispatches alerts once (deduped by completion key), then advances to the next step.
- Sound alert is emitted at the end of each completed step when sound is enabled.

## Notifications and Sound

- Sound and notifications can be toggled in Settings.
- Notification permission can be requested from the app UI.
- If direct `Notification` API is unavailable or blocked, the app tries service-worker delivery.
- Notification tags are deduplicated to avoid duplicate bursts.

## GitHub Pages Deployment

This repository is configured for deployment via GitHub Actions.

- Workflow file: `.github/workflows/deploy-pages.yml`
- Trigger: pushes to `main` and manual `workflow_dispatch`
- Artifact: `dist/`

Expected production URL:

- [https://mbogdan0.github.io/simple-pomodoro/](https://mbogdan0.github.io/simple-pomodoro/)

### Repository settings required (once)

In GitHub repository settings:

1. Open **Settings -> Pages**
2. Set **Source** to **GitHub Actions**

## Notes on Build Artifacts

- `dist/` is treated as a build artifact and should not be versioned.
- Deployment pipeline builds and publishes `dist/` automatically.

## Troubleshooting

- If notifications do not appear, verify browser permission and OS notification settings.
- If sound does not play, interact with the page first (browser autoplay policies may block audio before user gesture).
- If background behavior seems delayed, keep service worker enabled and avoid private browsing modes that aggressively suspend timers.
