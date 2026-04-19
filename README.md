# Simple Pomodoro Timer

<p align="center">
  <img src="docs/images/hero.png" alt="Simple Pomodoro Timer interface preview" width="980" />
</p>

<p align="center">
  A resilient browser-based focus timer for structured work cycles, mindful breaks, and clear progress tracking.
</p>

## Live Demo

**Try it now:** [https://mbogdan0.github.io/simple-pomodoro/](https://mbogdan0.github.io/simple-pomodoro/)

## Product Guide

### Why this app exists

Simple Pomodoro Timer helps you run focus cycles without setup friction. It is designed for people who want a clear workflow, predictable timing behavior, and enough flexibility to adapt sessions to real workdays.

### What users get

- **Plan sessions faster:** Configure work, short break, and long break durations plus repeat count in minutes.
- **Stay in flow:** Start, pause, resume, and reset quickly from one primary control area.
- **Track momentum visually:** See per-step progress, repeat indicators, and current cycle position at a glance.
- **Keep context across reloads:** Restore active session state and settings automatically from local storage.
- **Reduce tab-switch overhead:** Use Picture-in-Picture mode for a compact always-on-top timer view.
- **Get timely nudges:** Receive completion notifications and a one-minute reminder before work steps end.
- **Review focus patterns:** Save finished focus sessions in history with per-entry removal controls.

### Feature highlights

- **Cycle-aware workflow:** Repeated work sessions are separated by short breaks, then followed by a long break.
- **Actionable status language:** Step label, timer label, and control labels reflect current session state.
- **Accessible progress cues:** Repeat dots expose focus/break state and descriptive tooltip metadata.
- **Calm visual rhythm:** Step-specific color accents keep work and break phases easy to distinguish.
- **Low-friction settings:** Changes apply immediately when idle and safely defer while a session is active.

### Best-fit use cases

- Solo deep-work sessions with predictable breaks.
- Lightweight team co-working blocks where everyone follows the same cycle template.
- Browser-only environments where installing a native timer app is not preferred.

## Technical Guide

### Architecture overview

- Vanilla JavaScript ES modules with no UI framework.
- Single-page browser app with modularized `core` logic and `ui` rendering.
- Worker-based ticking and reconciliation loops for resilient time progression.
- Service Worker + app-shell caching for repeat offline visits.

### Reliability model

- **Primary ticker:** Web Worker loop runs at `250ms` cadence.
- **Completion watchdog:** Worker detects exact step completion boundaries.
- **Main-thread guard:** `500ms` reconciliation loop protects against missed updates.
- **Lifecycle recovery:** Visibility/focus/page lifecycle resync restores freshness after throttling.
- **Fresh-state arbitration:** Timestamp-driven synchronization keeps the newest state (`updatedAt`).

### Runtime capabilities

- Notifications through the browser Notification API with service worker fallback channeling.
- Optional ntfy.sh webhook push notifications on focus/break completion via a configured publish URL in Settings.
- Optional completion sound via Web Audio API.
- Optional vibration when supported by the platform.
- Dynamic document title and generated favicon for quick status awareness.
- Optional PiP clock rounding to 10-second updates while running, with edge-window precision.

### Offline and PWA behavior

- Offline support activates after at least one successful online load.
- App-shell assets are cached and refreshed through service worker versioning logic.
- Web App Manifest metadata is included for installability.
- Fresh offline use in brand-new profiles/incognito without prior online load is not supported.

Quick verification with Chrome DevTools:

1. Open the live URL online and wait for a full load.
2. In DevTools `Network`, set throttling to `Offline`.
3. Reload and verify that the app shell and timer controls still work.
4. Reopen the same URL while offline in the same profile.
5. Return online and reload once to refresh caches.

### Development

Quick start:

```bash
npm ci
npm run check
```

Build production assets:

```bash
npm run build
```

Scripts:

- `npm run test` - run unit tests with Vitest.
- `npm run build` - bundle production assets into `dist/`.
- `npm run check` - run tests and then build.

### Testing and release quality

- Unit tests cover timer state transitions, PiP behavior, UI rendering, storage, history, worker flows, and offline caching behavior.
- The recommended release gate is `npm run check` before version bump/tag publication.

### Deployment

GitHub Pages deployment runs via GitHub Actions (`.github/workflows/deploy-pages.yml`).

Live URL: [https://mbogdan0.github.io/simple-pomodoro/](https://mbogdan0.github.io/simple-pomodoro/)
