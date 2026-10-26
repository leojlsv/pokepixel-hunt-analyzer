import test from "node:test";
import assert from "node:assert/strict";
import { currentRetentionFootprint } from
  "../../userscript/performance-footprint.js";

test("retention diagnostics take exact O(1) structure sizes without reading rows", () => {
  const encounters = new Proxy({ length: 70_000 }, {
    get(target, key) {
      if (key === "length") return target.length;
      throw new Error("Footprint must never hydrate/iterate encounters");
    }
  });
  const sample = currentRetentionFootprint({
    encounters,
    indexes: { size: 70_000 },
    cardPresentation: {
      activeTargets: { size: 1 }, attemptHistory: { size: 32 },
      specialHistory: { size: 32 }, lootHistory: { size: 32 }
    },
    liveKeys: { size: 1 }, pendingChanges: { changes: { size: 3 } },
    pageWindow: { performance: { memory: {
      usedJSHeapSize: 25_000_000, totalJSHeapSize: 50_000_000,
      jsHeapSizeLimit: 2_000_000_000
    } } }
  });
  assert.deepEqual(sample, {
    canonicalCachedRows: 70_000, cachedEncounterIndexEntries: 70_000,
    liveActiveEncounterKeys: 1, cardActiveTargets: 1,
    cardRecentAttempts: 32, cardSpecialAttempts: 32,
    cardRecentLoot: 32, pendingEncounterChanges: 3,
    pageHeap: {
      usedJSHeapBytes: 25_000_000,
      jsHeapSizeLimitBytes: 2_000_000_000,
      totalJSHeapBytes: 50_000_000,
      scope: "browser-page-total-not-analyzer-owned"
    }
  });
});

test("absence of nonstandard heap API or thrown getter never interrupts diagnostic", () => {
  assert.equal(currentRetentionFootprint().pageHeap, null);
  const unsupported = {
    performance: { get memory() { throw new Error("denied"); } }
  };
  assert.equal(currentRetentionFootprint({ pageWindow: unsupported }).pageHeap, null);
  assert.equal(currentRetentionFootprint({ encounters: null }).canonicalCachedRows, null);
});
