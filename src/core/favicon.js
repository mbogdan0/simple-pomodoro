import { getCurrentStep, getProgressRatio, getRemainingMs } from './session.js';

const PALETTES = {
  completed: {
    background: '#f4efe7',
    ring: '#2f7a54',
    text: '#183127'
  },
  longBreak: {
    background: '#edf2ff',
    ring: '#3d69c5',
    text: '#183061'
  },
  shortBreak: {
    background: '#e8f5f1',
    ring: '#2f8c73',
    text: '#16483b'
  },
  work: {
    background: '#fff1eb',
    ring: '#c85a3a',
    text: '#552112'
  }
};

export function createFaviconModel(session, now = Date.now()) {
  const step = getCurrentStep(session);

  if (!step) {
    return {
      background: PALETTES.work.background,
      progress: 0,
      ring: PALETTES.work.ring,
      text: 'T',
      textColor: PALETTES.work.text
    };
  }

  const palette = session.status === 'completed_waiting_next'
    ? PALETTES.completed
    : PALETTES[step.type];
  const remainingMs = getRemainingMs(session, now);
  const badgeText = session.status === 'completed_waiting_next'
    ? '✓'
    : session.status === 'paused'
      ? 'II'
      : String(Math.max(1, Math.ceil(remainingMs / 60000))).slice(0, 2);

  return {
    background: palette.background,
    progress: getProgressRatio(session, now),
    ring: palette.ring,
    text: badgeText,
    textColor: palette.text
  };
}

export function renderFaviconDataUrl(model, documentObject = document) {
  const canvas = documentObject.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext('2d');

  if (!context) {
    return '';
  }

  context.clearRect(0, 0, 64, 64);

  context.fillStyle = model.background;
  context.beginPath();
  context.arc(32, 32, 28, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(24, 27, 31, 0.12)';
  context.lineWidth = 8;
  context.beginPath();
  context.arc(32, 32, 22, -Math.PI / 2, Math.PI * 1.5);
  context.stroke();

  context.strokeStyle = model.ring;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(32, 32, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * model.progress);
  context.stroke();

  context.fillStyle = model.textColor;
  context.font =
    '500 18px ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(model.text, 32, 34);

  return canvas.toDataURL('image/png');
}
