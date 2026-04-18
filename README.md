# Simple Pomodoro Timer

Simple Pomodoro Timer is a Pomodoro-style productivity timer built with vanilla JavaScript.
It runs the classic cycle of focused work sessions, short breaks, and a long break directly in the browser,
with no backend and no framework.

## Project Idea

The main goal is reliable timing in real browser conditions.
Modern browsers can throttle background tabs, so this project combines worker-based ticking,
state reconciliation, and persisted sessions to keep timer behavior predictable.

## How The Pomodoro Cycle Works

- A cycle is generated from your settings: repeated `work` sessions separated by `shortBreak`, then one `longBreak`.
- You can customize all step durations and the number of work repeats per cycle.
- When a step ends, the app marks it complete, sends alerts, and prepares the next step.
- The next step starts explicitly when you press `Start`, so transitions stay user-controlled.

## What It Includes

- Focus, short break, and long break steps
- Configurable durations and repeat count (`1-480` minutes per step, `1-24` repeats)
- Start, pause, and reset flow with cycle progress UI
- Per-step progress bar and repeat/step indicators
- Browser notifications with service worker fallback channel selection
- One-minute focus reminder notification before a work step ends
- Optional completion sound (Web Audio) and vibration support (when available)
- Dynamic tab title and generated favicon with live remaining time and progress
- Active session + settings persistence across reloads and tab restores
- Notification deduplication to avoid repeated alerts for the same step completion
- Background-friendly ticking with worker timer + safety sync loop
- App-shell caching for offline usage after the first online visit
- Static build output for simple hosting (for example GitHub Pages)

## Reliability Approach

- Worker-driven tick loop (`250ms`) for stable updates while the page is open
- Completion watchdog in the worker to detect exact step end reliably
- Main-thread safety reconciliation loop (`500ms`) as an additional guard
- Visibility/focus/page lifecycle resync to recover from throttling or tab suspension
- Timestamp-based session sync (`updatedAt`) to keep the freshest state
- Graceful fallback when worker/background features are unavailable

## Tech Stack

- Vanilla JavaScript (ES modules)
- Web Worker + Service Worker
- Web Notifications + Web Audio APIs
- localStorage persistence
- esbuild bundling
- Vitest unit tests

## Quick Start

```bash
npm ci
npm run check
```

Build static production files:

```bash
npm run build
```

## Scripts

- `npm run test` - run unit tests (Vitest)
- `npm run build` - bundle production assets into `dist/`
- `npm run check` - run tests, then build

## Offline Behavior (GitHub Pages)

- Live example: [https://mbogdan0.github.io/simple-pomodoro/](https://mbogdan0.github.io/simple-pomodoro/)
- Offline mode is available only after at least one successful online visit that installs the service worker and caches the app shell.
- Opening the app offline in a fresh browser profile/incognito window (with no prior online load) is not supported.
- Offline support remains available until browser site data for this origin is cleared.

Quick verification with Chrome DevTools:

1. Open the live URL while online and wait for the page to load.
2. Open DevTools, go to `Network`, and switch throttling to `Offline`.
3. Reload the page: `index.html` should load from cache and timer controls should work.
4. Close and reopen the same URL while still offline.
5. Switch back online and reload once to refresh cached assets.

## Deployment

GitHub Pages deployment runs via GitHub Actions (`.github/workflows/deploy-pages.yml`).
Live URL: [https://mbogdan0.github.io/simple-pomodoro/](https://mbogdan0.github.io/simple-pomodoro/)
