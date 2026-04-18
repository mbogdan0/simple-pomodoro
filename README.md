# Simple Pomodoro

A lightweight Pomodoro timer built with vanilla JavaScript. It runs fully in the browser with resilient background ticking, step-completion alerts, and local session/settings persistence.

## Quick Start

```bash
npm ci
npm run check
```

Build production assets into `dist/`:

```bash
npm run build
```

## Scripts

- `npm run test` - Run unit tests (Vitest)
- `npm run build` - Bundle app assets with esbuild
- `npm run check` - Run tests, then build

## Deployment

GitHub Pages deployment is handled by GitHub Actions (`.github/workflows/deploy-pages.yml`).
Production URL: [https://mbogdan0.github.io/simple-pomodoro/](https://mbogdan0.github.io/simple-pomodoro/)
