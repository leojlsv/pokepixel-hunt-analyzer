import assert from "node:assert/strict";
import test from "node:test";

import { buildMobileEncounterCardModel } from "../../userscript/mobile-encounter-renderer.js";

const encounter = {
  encounterId: "enc-1",
  speciesName: "Charizard",
  quality: "legendary",
  qualityMultiplier: 1.22,
  ivTotal: 174,
  isShiny: true,
  nature: "Timid",
  gender: "male",
  captureAtMs: new Date(2026, 8, 1, 14, 32, 18).getTime(),
  capsuleName: "Ultra Ball",
  captureChance: 0.18,
  ivs: { hp: 31, atk: 27, spa: 31, def: 28, spd: 29, spe: 28 }
};

test("captured mobile card keeps quick-decision fields and full IV detail", () => {
  const model = buildMobileEncounterCardModel("captured", encounter, encounter.captureAtMs - 60_000);

  assert.equal(model.name, "Charizard");
  assert.equal(model.shiny, true);
  assert.equal(model.rarity, "Legendary");
  assert.equal(model.ivTotal, "174");
  assert.equal(model.quality, "1.22x");
  assert.equal(model.natureGender, "Timid · ♂");
  assert.match(model.timestamp, /^14:32:18$/);
  assert.deepEqual(model.detail.ivs, [
    ["HP", "31"],
    ["Atk", "27"],
    ["sAtk", "31"],
    ["Def", "28"],
    ["sDef", "29"],
    ["SpD", "28"]
  ]);
  assert.equal(model.detail.capsule, "Ultra Ball");
  assert.equal(model.detail.chance, "18.00%");
});

test("failed mobile card stays compact and non-expandable", () => {
  const model = buildMobileEncounterCardModel("failed", encounter, encounter.captureAtMs - 60_000);

  assert.equal(model.name, "Charizard");
  assert.equal(model.rarity, "Legendary");
  assert.equal(model.ivTotal, "174");
  assert.equal(model.capsule, "Ultra Ball");
  assert.equal(model.chance, "18.00%");
  assert.equal(model.detail, null);
});
