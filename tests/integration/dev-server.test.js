import { afterEach, describe, expect, it } from 'vitest';

import { startDevServer } from '../../build.mjs';

describe('dev server smoke', () => {
  /** @type {{ host: string, port: number, stop: () => Promise<void> } | null} */
  let server = null;

  afterEach(async () => {
    if (!server) {
      return;
    }

    await server.stop();
    server = null;
  });

  it('serves app shell and worker entry in dev mode', async () => {
    server = await startDevServer({
      host: '127.0.0.1',
      port: 0
    });

    const baseUrl = `http://${server.host}:${server.port}`;
    const indexResponse = await fetch(`${baseUrl}/index.html`);
    const workerResponse = await fetch(`${baseUrl}/timer-worker.js`);

    expect(indexResponse.status).toBe(200);
    expect(workerResponse.status).toBe(200);

    const indexHtml = await indexResponse.text();
    const workerSource = await workerResponse.text();

    expect(indexHtml).toContain('<meta');
    expect(indexHtml).toContain('name="description"');
    expect(indexHtml).toContain('<link rel="canonical"');
    expect(indexHtml).toContain('href="https://mbogdan0.github.io/simple-pomodoro/"');
    expect(indexHtml).toContain('property="og:url"');
    expect(indexHtml).toContain('content="https://mbogdan0.github.io/simple-pomodoro/"');
    expect(indexHtml).toContain('name="twitter:card" content="summary_large_image"');
    expect(indexHtml).toContain('<script src="./main.js"></script>');
    expect(indexHtml).toContain('window.__APP_DEV__ = true');
    expect(indexHtml).not.toContain('window.__TIMER_WORKER_SOURCE__');
    expect(workerSource.length).toBeGreaterThan(0);
  }, 30_000);
});
