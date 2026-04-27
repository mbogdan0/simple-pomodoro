import { describe, expect, it } from 'vitest';

import {
  isAppShellRequest,
  isCacheableRequest,
  isNavigationRequest,
  resolveShellUrls
} from '../src/core/offline-cache.js';

describe('offline cache helpers', () => {
  it('marks only same-origin GET requests as cacheable', () => {
    const origin = 'https://mbogdan0.github.io';
    const sameOriginGet = new Request('https://mbogdan0.github.io/simple-pomodoro/index.html', {
      method: 'GET'
    });
    const sameOriginPost = new Request('https://mbogdan0.github.io/simple-pomodoro/index.html', {
      method: 'POST'
    });
    const crossOriginGet = new Request('https://example.com/simple-pomodoro/index.html', {
      method: 'GET'
    });

    expect(isCacheableRequest(sameOriginGet, origin)).toBe(true);
    expect(isCacheableRequest(sameOriginPost, origin)).toBe(false);
    expect(isCacheableRequest(crossOriginGet, origin)).toBe(false);
    expect(isCacheableRequest({ method: 'GET', url: 'not-a-valid-url' }, origin)).toBe(false);
  });

  it('detects navigate-mode requests', () => {
    expect(isNavigationRequest({ mode: 'navigate' })).toBe(true);
    expect(isNavigationRequest({ mode: 'cors' })).toBe(false);
    expect(isNavigationRequest(null)).toBe(false);
  });

  it('resolves app-shell resource URLs for a project pages scope', () => {
    expect(resolveShellUrls('https://mbogdan0.github.io/simple-pomodoro/')).toEqual([
      'https://mbogdan0.github.io/simple-pomodoro/',
      'https://mbogdan0.github.io/simple-pomodoro/index.html',
      'https://mbogdan0.github.io/simple-pomodoro/manifest.webmanifest',
      'https://mbogdan0.github.io/simple-pomodoro/assets/icons/icon-192.png',
      'https://mbogdan0.github.io/simple-pomodoro/assets/icons/icon-512.png',
      'https://mbogdan0.github.io/simple-pomodoro/timer-worker.js'
    ]);
  });

  it('classifies app-shell requests for a scope', () => {
    const scope = 'https://mbogdan0.github.io/simple-pomodoro/';
    const shellUrls = resolveShellUrls(scope);

    shellUrls.forEach((url) => {
      expect(isAppShellRequest(new Request(url, { method: 'GET' }), scope)).toBe(true);
    });

    expect(
      isAppShellRequest(
        new Request('https://mbogdan0.github.io/simple-pomodoro/index.html?v=2', {
          method: 'GET'
        }),
        scope
      )
    ).toBe(true);

    expect(
      isAppShellRequest(
        new Request('https://mbogdan0.github.io/simple-pomodoro/service-worker.js', {
          method: 'GET'
        }),
        scope
      )
    ).toBe(false);
    expect(
      isAppShellRequest(
        new Request('https://example.com/simple-pomodoro/index.html', { method: 'GET' }),
        scope
      )
    ).toBe(false);
    expect(
      isAppShellRequest(
        new Request('https://mbogdan0.github.io/simple-pomodoro/index.html', {
          method: 'POST'
        }),
        scope
      )
    ).toBe(false);
    expect(isAppShellRequest({ method: 'GET', url: 'not-a-valid-url' }, scope)).toBe(false);
  });
});
