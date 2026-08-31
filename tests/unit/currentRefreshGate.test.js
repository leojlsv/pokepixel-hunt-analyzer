import { test } from "node:test";
import assert from "node:assert/strict";

import { createCurrentRefreshGate } from "../../userscript/current-refresh-gate.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("coalesces overlapping refresh requests but reruns after the in-flight load", async () => {
  const first = deferred();
  let calls = 0;

  const gate = createCurrentRefreshGate(async () => {
    calls += 1;
    if (calls === 1) await first.promise;
  });

  const firstRun = gate.run();
  const overlappingRun = gate.run();

  assert.equal(firstRun, overlappingRun);
  assert.equal(calls, 1);
  assert.equal(gate.snapshot().rerunRequested, true);

  first.resolve();
  await firstRun;

  assert.equal(calls, 2);
  assert.deepEqual(
    {
      requests: gate.snapshot().requests,
      runs: gate.snapshot().runs,
      coalescedRequests: gate.snapshot().coalescedRequests,
      reruns: gate.snapshot().reruns,
      inFlight: gate.snapshot().inFlight
    },
    {
      requests: 2,
      runs: 2,
      coalescedRequests: 1,
      reruns: 1,
      inFlight: false
    }
  );
});

test("multiple requests during one load collapse into one latest-state rerun", async () => {
  const first = deferred();
  let calls = 0;

  const gate = createCurrentRefreshGate(async () => {
    calls += 1;
    if (calls === 1) await first.promise;
  });

  const promise = gate.run();
  gate.run();
  gate.run();
  gate.run();

  first.resolve();
  await promise;

  assert.equal(calls, 2);
  assert.equal(gate.snapshot().requests, 4);
  assert.equal(gate.snapshot().coalescedRequests, 3);
  assert.equal(gate.snapshot().reruns, 1);
});

test("releases the gate after a failed load so a later refresh can recover", async () => {
  const failure = new Error("transient read failure");
  let calls = 0;

  const gate = createCurrentRefreshGate(async () => {
    calls += 1;
    if (calls === 1) throw failure;
  });

  await assert.rejects(gate.run(), failure);
  assert.equal(gate.snapshot().inFlight, false);

  await gate.run();

  assert.equal(calls, 2);
  assert.equal(gate.snapshot().runs, 2);
  assert.equal(gate.snapshot().inFlight, false);
});

test("reports refresh duration without affecting execution", async () => {
  let clock = 100;
  const gate = createCurrentRefreshGate(async () => {
    clock += 25;
  }, { now: () => clock });

  await gate.run();

  assert.equal(gate.snapshot().lastDurationMs, 25);
  assert.equal(gate.snapshot().maxDurationMs, 25);
});
