export function createWorkerCommandBus() {
  let postWorkerActionImpl = () => {};
  let syncWorkerStateImpl = () => {};

  function bindWorkerBridge(workerBridge) {
    if (!workerBridge) {
      return;
    }

    postWorkerActionImpl = workerBridge.postWorkerAction;
    syncWorkerStateImpl = workerBridge.syncWorkerState;
  }

  function postWorkerAction(type, payload) {
    postWorkerActionImpl(type, payload);
  }

  function syncWorkerState() {
    syncWorkerStateImpl();
  }

  return {
    bindWorkerBridge,
    postWorkerAction,
    syncWorkerState
  };
}
