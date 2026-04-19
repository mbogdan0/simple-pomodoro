function clampProgress(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function sanitizeText(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return fallback;
}

function sanitizeColor(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

export function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeModel(model = {}) {
  const status = ['running', 'paused'].includes(model.status) ? model.status : 'idle';

  return {
    accent: sanitizeColor(model.accent, '#2f8c73'),
    clock: sanitizeText(model.clock, '00:00'),
    progressTrack: sanitizeColor(model.progressTrack, '#ede7de'),
    progressPercent: clampProgress(model.progressPercent),
    status,
    stepLabel: sanitizeText(model.stepLabel, 'Timer')
  };
}

export function getActionForStatus(status) {
  if (status === 'running') {
    return {
      code: 'PAUSE',
      label: 'Pause'
    };
  }

  if (status === 'paused') {
    return {
      code: 'RESUME',
      label: 'Resume'
    };
  }

  return {
    code: 'START',
    label: 'Start'
  };
}
