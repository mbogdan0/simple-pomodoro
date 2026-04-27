import { getCurrentStep, getProgressRatio } from './session.js';

const PALETTES = {
  completed: {
    background: '#f4efe7',
    ring: '#2f7a54'
  },
  longBreak: {
    background: '#edf2ff',
    ring: '#3d69c5'
  },
  shortBreak: {
    background: '#e8f5f1',
    ring: '#2f8c73'
  },
  work: {
    background: '#fff1eb',
    ring: '#c85a3a'
  }
};

export function createFaviconModel(session, now = Date.now()) {
  const step = getCurrentStep(session);

  if (!step) {
    return {
      background: PALETTES.work.background,
      progress: 0,
      ring: PALETTES.work.ring
    };
  }

  const palette =
    session.status === 'completed_waiting_next' ? PALETTES.completed : PALETTES[step.type];

  return {
    background: palette.background,
    progress: getProgressRatio(session, now),
    ring: palette.ring
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

  return canvas.toDataURL('image/png');
}
