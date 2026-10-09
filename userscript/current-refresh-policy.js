export function needsPeriodicCurrentRefresh({ currentVisible = false, lastFullReadAtMs = null, now = Date.now(), graceMs = 0 } = {}) {
  return currentVisible === true || (Number.isFinite(lastFullReadAtMs)
    && Number.isFinite(now) && now >= lastFullReadAtMs && now - lastFullReadAtMs <= graceMs);
}
