import assert from "node:assert/strict";
import test from "node:test";
import { needsPeriodicCurrentRefresh } from "../../userscript/current-refresh-policy.js";

test("embed without a full reader does not run the Current ticker", () => {
  assert.equal(needsPeriodicCurrentRefresh({ currentVisible:false, now:1000, graceMs:3000 }), false);
});
test("recent full public reader permits the Current ticker through grace", () => {
  assert.equal(needsPeriodicCurrentRefresh({ currentVisible:false, lastFullReadAtMs:900, now:1000, graceMs:3000 }), true);
  assert.equal(needsPeriodicCurrentRefresh({ currentVisible:false, lastFullReadAtMs:900, now:4000, graceMs:3000 }), false);
});
test("visible standalone Current runs the ticker", () => {
  assert.equal(needsPeriodicCurrentRefresh({ currentVisible:true, now:1000 }), true);
});
test("closed panel and History without a full reader skip the ticker", () => {
  for (const currentVisible of [false, undefined])
    assert.equal(needsPeriodicCurrentRefresh({ currentVisible, lastFullReadAtMs:null, now:1000 }), false);
});
