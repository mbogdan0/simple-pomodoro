const DEFAULT_INTERVAL_MS = 500;

export function createSafetyLoop({
  clearIntervalFn = globalThis.clearInterval,
  intervalMs = DEFAULT_INTERVAL_MS,
  onTick,
  setIntervalFn = globalThis.setInterval
}) {
  let intervalHandle = null;

  function start() {
    if (intervalHandle !== null) {
      return;
    }

    intervalHandle = setIntervalFn(onTick, intervalMs);
  }

  function stop() {
    if (intervalHandle === null) {
      return;
    }

    clearIntervalFn(intervalHandle);
    intervalHandle = null;
  }

  return {
    start,
    stop
  };
}
