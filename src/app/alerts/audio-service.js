import { playCompletionToneOnContext, playUiActionToneOnContext } from '../../utils/audio.js';

export function createAudioService(targetWindow = globalThis.window) {
  let audioContext = null;
  let isPrimed = false;
  let primeHandler = null;

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
    if (isPrimed) {
      return;
    }

    primeHandler = () => {
      const context = ensureAudioContext();

      if (!context) {
        return;
      }

      context.resume().catch(() => {});
    };

    targetWindow.addEventListener?.('pointerdown', primeHandler, { passive: true });
    targetWindow.addEventListener?.('keydown', primeHandler, { passive: true });
    isPrimed = true;
  }

  function dispose() {
    if (primeHandler) {
      targetWindow.removeEventListener?.('pointerdown', primeHandler);
      targetWindow.removeEventListener?.('keydown', primeHandler);
      primeHandler = null;
    }

    isPrimed = false;

    if (audioContext && typeof audioContext.close === 'function') {
      audioContext.close().catch(() => {});
    }

    audioContext = null;
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
    dispose,
    playCompletionTone,
    playUiActionTone,
    primeOnGesture
  };
}
