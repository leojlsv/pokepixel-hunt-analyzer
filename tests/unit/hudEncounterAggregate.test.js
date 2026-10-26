import test from "node:test";
import assert from "node:assert/strict";
import { deriveClosedHudState } from "../../userscript/closed-hud.js";
import {
  createHudEncounterAggregate,
  updateHudEncounterAggregate,
  snapshotHudEncounterAggregate
} from "../../userscript/hud-encounter-aggregate.js";

function sortedEntries(map) {
  return [...map.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)));
}

function assertEquivalent(rows, index, label) {
  const full = deriveClosedHudState({ metrics: {}, encounters: [...rows.values()] });
  const incremental = snapshotHudEncounterAggregate(index);
  assert.equal(incremental.highestIv, full.highestIv, `${label}: highest IV`);
  assert.equal(incremental.totalBallsUsed, full.totalBallsUsed, `${label}: total used`);
  assert.deepEqual(sortedEntries(incremental.ballStats), sortedEntries(full.ballStats), `${label}: ball buckets`);
  assert.deepEqual(sortedEntries(incremental.ballUsage), sortedEntries(full.ballUsage), `${label}: used per ball`);
}

test("incremental HUD encounter projection equals a full scan across corrections and session reset", () => {
  const rows = new Map();
  for (let index = 0; index < 4_000; index += 1) {
    const value = {
      encounterId: `row-${index}`,
      ivTotal: index % 151,
      captureResult: index % 7 === 0 ? "success" : index % 9 === 0 ? "failed" : null,
      capsuleItemId: index % 11 === 0 ? "" : `ball-${index % 9}`,
      supplyCost: index % 13
    };
    rows.set(value.encounterId, value);
  }

  const aggregate = createHudEncounterAggregate(rows.values());
  assertEquivalent(rows, aggregate, "initial 4000 encounters");

  for (let index = 0; index < 800; index += 1) {
    const id = `row-${(index * 37) % 4_000}`;
    const previous = rows.get(id) || null;
    const next = index % 17 === 0 ? null : {
      encounterId: id,
      ivTotal: index % 23 === 0 ? null : (index * 7) % 187,
      captureResult: index % 3 === 0 ? "success" : index % 2 === 0 ? "failed" : undefined,
      capsuleItemId: `ball-${index % 15}`,
      supplyCost: index % 29
    };
    if (next) rows.set(id, next);
    else rows.delete(id);
    updateHudEncounterAggregate(aggregate, previous, next);
    if (index % 80 === 0) assertEquivalent(rows, aggregate, `mutation ${index}`);
  }
  assertEquivalent(rows, aggregate, "final after corrections/deletions");

  const lastMax = [...rows.values()].find(row => Number.isFinite(row.ivTotal) && row.ivTotal > 0);
  const old = rows.get(lastMax.encounterId);
  const raised = { ...old, ivTotal: 10_000 };
  rows.set(raised.encounterId, raised);
  updateHudEncounterAggregate(aggregate, old, raised);
  assertEquivalent(rows, aggregate, "outlier IV raised");
  rows.delete(raised.encounterId);
  updateHudEncounterAggregate(aggregate, raised, null);
  assertEquivalent(rows, aggregate, "maximum removed");

  const newHunt = createHudEncounterAggregate([]);
  assertEquivalent(new Map(), newHunt, "new Hunt is empty");
});

test("updating one encounter does not iterate unrelated prior rows", () => {
  const original = { encounterId: "a", captureResult: "success", capsuleItemId: "ball", ivTotal: 110, supplyCost: 5 };
  const state = createHudEncounterAggregate([original]);
  const corrected = { ...original, captureResult: "failed", ivTotal: 140, supplyCost: 7 };
  updateHudEncounterAggregate(state, original, corrected);
  assertEquivalent(new Map([["a", corrected]]), state, "single-row correction");
});
