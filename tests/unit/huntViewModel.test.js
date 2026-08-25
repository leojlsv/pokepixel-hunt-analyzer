import test from "node:test";
import assert from "node:assert/strict";

import {
  latestSpeciesEncounter,
  notableEncounters
} from "../../userscript/hunt-view-model.js";

function encounter(overrides = {}) {
  return {
    encounterId: overrides.encounterId || crypto.randomUUID(),
    speciesId: "kadabra",
    speciesName: "Kadabra",
    quality: "common",
    captureResult: "failed",
    startedAtMs: 1_000,
    captureAtMs: 1_100,
    updatedAtMs: 1_100,
    ...overrides
  };
}

test("latestSpeciesEncounter selects the most recent usable Hunt target", () => {
  const old = encounter({ encounterId: "old", speciesId: "abra", speciesName: "Abra", updatedAtMs: 2_000 });
  const latest = encounter({ encounterId: "latest", speciesId: "kadabra", speciesName: "Kadabra", startedAtMs: 3_000, captureAtMs: null, updatedAtMs: 3_000 });
  const orphanWithoutSpecies = encounter({ encounterId: "orphan", speciesId: null, speciesName: null, updatedAtMs: 4_000 });

  assert.equal(latestSpeciesEncounter([old, latest, orphanWithoutSpecies]), latest);
  assert.equal(latestSpeciesEncounter([]), null);
});

test("notableEncounters returns only terminal encounters for the selected notable rarity", () => {
  const rows = [
    encounter({ encounterId: "old-leg", quality: "legendary", captureResult: "failed", captureAtMs: 2_000 }),
    encounter({ encounterId: "recent-leg", quality: "legendary", captureResult: "success", captureAtMs: 4_000 }),
    encounter({ encounterId: "incomplete-leg", quality: "legendary", captureResult: "none", captureAtMs: null }),
    encounter({ encounterId: "epic", quality: "epic", captureResult: "failed", captureAtMs: 5_000 })
  ];

  assert.deepEqual(
    notableEncounters(rows, "legendary").map((row) => row.encounterId),
    ["recent-leg", "old-leg"]
  );
  assert.deepEqual(notableEncounters(rows, "rare"), []);
});
