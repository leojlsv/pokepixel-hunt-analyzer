import assert from "node:assert/strict";
import test from "node:test";
import {
  latestCaptureAttemptFromRows,
  updateLatestCaptureAttempt
} from "../../userscript/latest-capture-attempt.js";

test("latest capture attempt selects the newest valid terminal chance", () => {
  const latest = latestCaptureAttemptFromRows([
    { encounterId: "a", captureResult: "failed", captureChance: 0.5, captureAtMs: 10 },
    { encounterId: "b", captureResult: "success", captureChance: 0.04, captureAtMs: 20 },
    { encounterId: "c", captureResult: "failed", captureChance: 2, captureAtMs: 30 },
    { encounterId: "d", captureResult: null, captureChance: 0.2, captureAtMs: 40 }
  ]);
  assert.deepEqual(latest, { chance: 0.04, atMs: 20, tieKey: "b" });
});

test("latest capture attempt updates incrementally and resolves equal timestamps deterministically", () => {
  let latest = null;
  latest = updateLatestCaptureAttempt(latest, {
    encounterId: "b", captureResult: "failed", captureChance: 0.1, captureAtMs: 50
  });
  latest = updateLatestCaptureAttempt(latest, {
    encounterId: "a", captureResult: "failed", captureChance: 0.2, captureAtMs: 50
  });
  assert.equal(latest.chance, 0.1);
  latest = updateLatestCaptureAttempt(latest, {
    encounterId: "c", captureResult: "success", captureChance: 0.03, captureAtMs: 50
  });
  assert.equal(latest.chance, 0.03);
});

test("invalid chance or timestamp never replaces the cached latest attempt", () => {
  const current = { chance: 0.2, atMs: 100, tieKey: "x" };
  assert.equal(updateLatestCaptureAttempt(current, {
    encounterId: "y", captureResult: "failed", captureChance: -1, captureAtMs: 200
  }), current);
  assert.equal(updateLatestCaptureAttempt(current, {
    encounterId: "z", captureResult: "failed", captureChance: 0.3, captureAtMs: NaN
  }), current);
  assert.equal(updateLatestCaptureAttempt(current, {
    encounterId: "null-chance", captureResult: "failed", captureChance: null, captureAtMs: 200
  }), current);
  assert.equal(updateLatestCaptureAttempt(current, {
    encounterId: "empty-chance", captureResult: "failed", captureChance: "", captureAtMs: 200
  }), current);
  assert.equal(updateLatestCaptureAttempt(current, {
    encounterId: "null-time", captureResult: "failed", captureChance: 0.3, captureAtMs: null
  }), current);
});
