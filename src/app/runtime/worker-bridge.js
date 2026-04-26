import { normalizeSession } from '../../core/session.js';
import { WORKER_ACTIONS, WORKER_MESSAGE_TYPES } from '../../core/worker-protocol.js';

const DEFAULT_BACKGROUND_UNAVAILABLE_NOTICE = 'Background timer support is currently unavailable.';
const DEFAULT_BACKGROUND_UNSUPPORTED_NOTICE =
  'This browser may throttle timer updates in background tabs.';

export function createWorkerBridge({
  state,
  backgroundUnavailableNotice = DEFAULT_BACKGROUND_UNAVAILABLE_NOTICE,
  backgroundUnsupportedNotice = DEFAULT_BACKGROUND_UNSUPPORTED_NOTICE,
  handleLocalAction,
  onIdleReminder = () => {},
  onWorkerMissing = () => {},
  onWorkerState,
  onWorkerTick,
  onWorkerUnavailable
}) {
  let timerWorker = null;

  function createWorkerInstance() {
    if (typeof Worker === 'undefined') {
      state.backgroundNotice = backgroundUnsupportedNotice;
      return null;
    }

    const inlineSource = globalThis.__TIMER_WORKER_SOURCE__;

    if (typeof inlineSource === 'string' && inlineSource) {
      const blobUrl = URL.createObjectURL(
        new Blob([inlineSource], { type: 'text/javascript' })
      );
      const worker = new Worker(blobUrl);
      worker.addEventListener(
        'message',
        () => {
          URL.revokeObjectURL(blobUrl);
        },
        { once: true }
      );
      state.backgroundNotice = '';
      return worker;
    }

    state.backgroundNotice = '';
    return new Worker('timer-worker.js');
  }

  function disposeWorker() {
    if (!timerWorker) {
      return;
    }

    try {
      timerWorker.removeEventListener('message', handleWorkerMessage);
      timerWorker.removeEventListener('error', handleWorkerRuntimeError);
    } catch {
      // Ignore worker listener cleanup errors.
    }

    try {
      timerWorker.terminate?.();
    } catch {
      // Ignore worker termination errors.
    }

    timerWorker = null;
  }

  function disableWorkerAndSwitchToLocal(nextSession = state.activeSession) {
    disposeWorker();
    state.backgroundNotice = backgroundUnavailableNotice;
    onWorkerUnavailable(nextSession);
  }

  function handleWorkerRuntimeError() {
    disableWorkerAndSwitchToLocal(state.activeSession);
  }

  function handleWorkerMessage(event) {
    const { completionKey, now, reason, session, type } = event.data ?? {};

    if (type === WORKER_MESSAGE_TYPES.ERROR) {
      disableWorkerAndSwitchToLocal(session ?? state.activeSession);
      return;
    }

    if (type === WORKER_MESSAGE_TYPES.IDLE_REMINDER) {
      onIdleReminder(now ?? Date.now());
      return;
    }

    if (!session) {
      return;
    }

    const normalized = normalizeSession(session, state.settings);

    if (type === WORKER_MESSAGE_TYPES.TICK) {
      state.activeSession = normalized;
      onWorkerTick(normalized);
      return;
    }

    onWorkerState({
      completionKey,
      reason,
      session: normalized,
      type
    });
  }

  function syncWorkerState() {
    if (!timerWorker) {
      return;
    }

    try {
      timerWorker.postMessage({
        payload: {
          session: state.activeSession
        },
        type: WORKER_ACTIONS.INIT
      });
    } catch {
      disableWorkerAndSwitchToLocal(state.activeSession);
    }
  }

  function postWorkerAction(type, payload = {}) {
    if (!timerWorker) {
      handleLocalAction(type, payload);
      return;
    }

    try {
      timerWorker.postMessage({
        payload,
        type
      });
    } catch {
      disableWorkerAndSwitchToLocal(state.activeSession);
      handleLocalAction(type, payload);
    }
  }

  function syncWorkerNow(now = Date.now()) {
    postWorkerAction(WORKER_ACTIONS.SYNC_NOW, { now });
  }

  function setupWorker() {
    try {
      timerWorker = createWorkerInstance();

      if (!timerWorker) {
        onWorkerMissing();
        return;
      }

      timerWorker.addEventListener('message', handleWorkerMessage);
      timerWorker.addEventListener('error', handleWorkerRuntimeError);
      syncWorkerState();
    } catch {
      disableWorkerAndSwitchToLocal(state.activeSession);
    }
  }

  return {
    disposeWorker,
    postWorkerAction,
    setupWorker,
    syncWorkerNow,
    syncWorkerState
  };
}
