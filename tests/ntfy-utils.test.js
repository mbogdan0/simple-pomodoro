import { describe, expect, it, vi } from 'vitest';

import {
  NTFY_PRIORITY,
  createNtfyRequestOptions,
  createNtfyTestPayload,
  sendNtfyPush
} from '../src/utils/ntfy.js';

describe('ntfy utils', () => {
  it('builds ntfy request options with expected method, headers and body', () => {
    const options = createNtfyRequestOptions({
      body: 'Body text',
      title: 'Custom title'
    });

    expect(options).toEqual({
      body: 'Body text',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        Priority: NTFY_PRIORITY,
        Title: 'Custom title'
      },
      method: 'POST'
    });
  });

  it('sends ntfy push and returns boolean result', async () => {
    const okFetch = vi.fn(async () => ({ ok: true }));
    const failFetch = vi.fn(async () => ({ ok: false }));
    const throwFetch = vi.fn(async () => {
      throw new Error('Network error');
    });

    const payload = {
      body: 'Manual ntfy test from Timer.',
      title: 'Timer ntfy test'
    };

    await expect(
      sendNtfyPush({
        fetchImpl: okFetch,
        payload,
        publishUrl: 'https://ntfy.sh/topic'
      })
    ).resolves.toBe(true);
    expect(okFetch).toHaveBeenCalledWith('https://ntfy.sh/topic', createNtfyRequestOptions(payload));

    await expect(
      sendNtfyPush({
        fetchImpl: failFetch,
        payload,
        publishUrl: 'https://ntfy.sh/topic'
      })
    ).resolves.toBe(false);

    await expect(
      sendNtfyPush({
        fetchImpl: throwFetch,
        payload,
        publishUrl: 'https://ntfy.sh/topic'
      })
    ).resolves.toBe(false);
  });

  it('returns a stable dedicated test payload', () => {
    expect(createNtfyTestPayload()).toEqual({
      body: 'Manual ntfy test from Timer.',
      title: 'Timer ntfy test'
    });
  });
});
