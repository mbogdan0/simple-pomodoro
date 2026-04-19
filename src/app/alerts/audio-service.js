import { playCompletionToneOnContext, playUiActionToneOnContext } from '../../utils/audio.js';

export function createAudioService(targetWindow = globalThis.window) {
  let audioContext = null;

  function canUseAudioContext() {
    return Boolean(targetWindow && typeof targetWindow.AudioContext !== 'undefined');
  }

  function ensureAudioContext() {
    if (!canUseAudioContext()) {
      return null;
    }

    if (!audioContext) {
      audioContext = new targetWindow.AudioContext();
    }

    return audioContext;
  }

  function primeOnGesture() {
    const prime = () => {
      const context = ensureAudioContext();

      if (!context) {
        return;
      }

      context.resume().catch(() => {});
    };

    targetWindow.addEventListener('pointerdown', prime, { passive: true });
    targetWindow.addEventListener('keydown', prime, { passive: true });
  }

  function playCompletionTone() {
    const context = ensureAudioContext();

    if (!context) {
      return false;
    }

    return playCompletionToneOnContext(context);
  }

  function playUiActionTone(soundEnabled = true) {
    if (!soundEnabled) {
      return false;
    }

    const context = ensureAudioContext();

    if (!context) {
      return false;
    }

    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    return playUiActionToneOnContext(context);
  }

  return {
    playCompletionTone,
    playUiActionTone,
    primeOnGesture
  };
}
