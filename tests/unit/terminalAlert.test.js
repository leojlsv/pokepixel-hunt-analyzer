import { test } from "node:test";
import assert from "node:assert/strict";

import { buildTerminalAlert } from "../../domain/terminalAlert.js";

function stateWithEncounter(wildMonsterId, encounter) {
  return {
    activeByWildMonsterId: new Map([[wildMonsterId, "encounter_1"]]),
    inProgress: new Map([["encounter_1", encounter]])
  };
}

test("correlated combat snapshot wins over capture.failed fallback fields", () => {
  const state = stateWithEncounter("wild_1", {
    quality: "legendary",
    isShiny: true
  });
  const envelope = {
    type: "capture.failed",
    data: {
      wild_monster_id: "wild_1",
      quality: "weak",
      is_shiny: false
    }
  };

  assert.deepEqual(buildTerminalAlert(envelope, state), {
    result: "fled",
    rarity: "legendary",
    isShiny: true
  });
});

test("orphan capture.failed falls back to its own rarity and Shiny fields", () => {
  const envelope = {
    type: "capture.failed",
    data: {
      wild_monster_id: "wild_orphan",
      quality: "epic",
      is_shiny: true
    }
  };

  assert.deepEqual(buildTerminalAlert(envelope, null), {
    result: "fled",
    rarity: "epic",
    isShiny: true
  });
});

test("orphan capture.success falls back to captured creature metadata", () => {
  const envelope = {
    type: "capture.success",
    data: {
      wild_monster_id: "wild_orphan",
      creature: {
        quality: "mythical",
        is_shiny: false
      }
    }
  };

  assert.deepEqual(buildTerminalAlert(envelope, null), {
    result: "captured",
    rarity: "mythical",
    isShiny: false
  });
});

test("non-terminal protocol events do not emit an alert descriptor", () => {
  assert.equal(buildTerminalAlert({ type: "loot.received", data: {} }, null), null);
});
