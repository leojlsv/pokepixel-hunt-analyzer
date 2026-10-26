/**
 * Demand-only, O(1) diagnostic of retained Current structures. It does not
 * scan encounter history or register observers/timers. Optional Chrome
 * performance.memory describes the WHOLE PAGE, not Analyzer's private heap.
 */
function validSize(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function currentRetentionFootprint({
  encounters = [], indexes = null, cardPresentation = null,
  liveKeys = null, pendingChanges = null, pageWindow = null
} = {}) {
  const cards = cardPresentation || {};
  let pageHeap = null;
  try {
    const memory = pageWindow?.performance?.memory;
    if (memory && Number.isFinite(memory.usedJSHeapSize) &&
        memory.usedJSHeapSize >= 0) {
      pageHeap = {
        usedJSHeapBytes: memory.usedJSHeapSize,
        jsHeapSizeLimitBytes: Number.isFinite(memory.jsHeapSizeLimit)
          ? memory.jsHeapSizeLimit : null,
        totalJSHeapBytes: Number.isFinite(memory.totalJSHeapSize)
          ? memory.totalJSHeapSize : null,
        scope: "browser-page-total-not-analyzer-owned"
      };
    }
  } catch {
    // Some userscript worlds/browser versions expose no performance.memory.
  }
  return {
    canonicalCachedRows: validSize(encounters?.length),
    cachedEncounterIndexEntries: validSize(indexes?.size),
    liveActiveEncounterKeys: validSize(liveKeys?.size),
    cardActiveTargets: validSize(cards.activeTargets?.size),
    cardRecentAttempts: validSize(cards.attemptHistory?.size),
    cardSpecialAttempts: validSize(cards.specialHistory?.size),
    cardRecentLoot: validSize(cards.lootHistory?.size),
    pendingEncounterChanges: validSize(pendingChanges?.changes?.size),
    pageHeap
  };
}
