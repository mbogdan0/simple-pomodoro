export const NTFY_PRIORITY = '4';
export const NTFY_TEST_TITLE = 'Simple Pomodoro Timer ntfy test 📡';
export const NTFY_TEST_BODY = 'Manual ntfy test from Simple Pomodoro Timer.';

function toHeaderSafeValue(value = '') {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x20 && code <= 0xff;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createNtfyTestPayload() {
  return {
    body: NTFY_TEST_BODY,
    title: NTFY_TEST_TITLE
  };
}

export function createNtfyRequestOptions(payload = {}) {
  return {
    body: typeof payload.body === 'string' ? payload.body : '',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      Priority: NTFY_PRIORITY,
      Title: toHeaderSafeValue(payload.title)
    },
    method: 'POST'
  };
}

export async function sendNtfyPush({
  fetchImpl = globalThis.fetch,
  payload,
  publishUrl
}) {
  if (!publishUrl || typeof fetchImpl !== 'function') {
    return false;
  }

  try {
    const response = await fetchImpl(publishUrl, createNtfyRequestOptions(payload));
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}
