export function createPageClockSync({ updatePageChrome, updateTimerLiveRegion }) {
  function syncNow(now = Date.now()) {
    updateTimerLiveRegion(now);
    updatePageChrome(now);
    return now;
  }

  return {
    syncNow
  };
}
