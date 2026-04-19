export const UI_ACTION_TONE_DURATION_SECONDS = 0.06;

export function playCompletionToneOnContext(audioContext) {
  const startAt = audioContext.currentTime;
  const baseDuration = 1.05;
  const totalDuration = 1.4;
  const envelopeScale = totalDuration / baseDuration;
  const finishAt = startAt + totalDuration;

  const leadOscillator = audioContext.createOscillator();
  const harmonyOscillator = audioContext.createOscillator();
  const leadGain = audioContext.createGain();
  const harmonyGain = audioContext.createGain();
  const masterGain = audioContext.createGain();

  leadOscillator.type = 'triangle';
  leadOscillator.frequency.setValueAtTime(740, startAt);
  leadOscillator.frequency.linearRampToValueAtTime(980, startAt + 0.18 * envelopeScale);
  leadOscillator.frequency.linearRampToValueAtTime(840, startAt + 0.48 * envelopeScale);
  leadOscillator.frequency.linearRampToValueAtTime(1040, startAt + 0.78 * envelopeScale);
  leadOscillator.frequency.linearRampToValueAtTime(900, finishAt);

  harmonyOscillator.type = 'sine';
  harmonyOscillator.frequency.setValueAtTime(370, startAt);
  harmonyOscillator.frequency.linearRampToValueAtTime(430, startAt + 0.24 * envelopeScale);
  harmonyOscillator.frequency.linearRampToValueAtTime(390, startAt + 0.6 * envelopeScale);
  harmonyOscillator.frequency.linearRampToValueAtTime(450, finishAt);

  leadGain.gain.setValueAtTime(0.0001, startAt);
  leadGain.gain.linearRampToValueAtTime(0.24, startAt + 0.05 * envelopeScale);
  leadGain.gain.linearRampToValueAtTime(0.18, startAt + 0.32 * envelopeScale);
  leadGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

  harmonyGain.gain.setValueAtTime(0.0001, startAt);
  harmonyGain.gain.linearRampToValueAtTime(0.13, startAt + 0.08 * envelopeScale);
  harmonyGain.gain.linearRampToValueAtTime(0.1, startAt + 0.38 * envelopeScale);
  harmonyGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

  masterGain.gain.setValueAtTime(0.9, startAt);

  leadOscillator.connect(leadGain);
  harmonyOscillator.connect(harmonyGain);
  leadGain.connect(masterGain);
  harmonyGain.connect(masterGain);
  masterGain.connect(audioContext.destination);

  leadOscillator.start(startAt);
  harmonyOscillator.start(startAt);
  leadOscillator.stop(finishAt);
  harmonyOscillator.stop(finishAt);
  return true;
}

export function playUiActionToneOnContext(audioContext) {
  const startAt = audioContext.currentTime;
  const finishAt = startAt + UI_ACTION_TONE_DURATION_SECONDS;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(920, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(760, finishAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(0.07, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(startAt);
  oscillator.stop(finishAt + 0.005);
  return true;
}
