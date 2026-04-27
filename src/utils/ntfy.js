export const NTFY_PRIORITY = '4';
export const NTFY_TEST_TITLE = '🧪 ntfy test';
export const NTFY_TEST_BODY = 'Manual ntfy test.';

const NTFY_TITLE_EMOJI_BY_STEP_TYPE = {
  longBreak: '🌴',
  shortBreak: '☕',
  work: '🎯'
};

const NTFY_STEP_TITLE_LABELS = {
  longBreak: 'Long Break',
  shortBreak: 'Short Break',
  work: 'Focus'
};

const NTFY_COMPLETION_BODY_SHORTENINGS = {
  'Cycle finished. Press Start to begin a new cycle.': 'Cycle finished. Press Start.',
  'Next step is ready. Press Start to continue.': 'Next step ready. Press Start.',
  'Next step started automatically.': 'Next step auto-started.'
};

function normalizeHeaderValue(value = '') {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toUtf8Base64(value = '') {
  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(value, 'utf-8').toString('base64');
  }

  if (typeof TextEncoder === 'function' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(value);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary);
  }

  return '';
}

function toHeaderTitleValue(value = '') {
  const normalized = normalizeHeaderValue(value);

  if (!normalized) {
    return '';
  }

  if (/^[\x20-\x7E]*$/.test(normalized)) {
    return normalized;
  }

  const base64Value = toUtf8Base64(normalized);
  return base64Value ? `=?UTF-8?B?${base64Value}?=` : normalized;
}

function normalizeNtfyStepType(stepType = '') {
  return Object.prototype.hasOwnProperty.call(NTFY_TITLE_EMOJI_BY_STEP_TYPE, stepType)
    ? stepType
    : 'work';
}

export function resolveNtfyCompletionTitle(stepType = 'work') {
  const normalizedStepType = normalizeNtfyStepType(stepType);
  const emoji = NTFY_TITLE_EMOJI_BY_STEP_TYPE[normalizedStepType];
  const label = NTFY_STEP_TITLE_LABELS[normalizedStepType];

  return `${emoji} ${label}`;
}

function shortenNtfyCompletionBody(body = '') {
  if (typeof body !== 'string') {
    return '';
  }

  return NTFY_COMPLETION_BODY_SHORTENINGS[body] ?? body;
}

export function createNtfyCompletionPayload({ body = '', stepType = 'work' } = {}) {
  return {
    body: shortenNtfyCompletionBody(body),
    title: resolveNtfyCompletionTitle(stepType)
  };
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
      Title: toHeaderTitleValue(payload.title)
    },
    method: 'POST'
  };
}

export async function sendNtfyPush({ fetchImpl = globalThis.fetch, payload, publishUrl }) {
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
