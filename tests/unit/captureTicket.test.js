import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeEvent } from "../../domain/events.js";
import { applyEvent, createTrackerState } from "../../domain/encounterTracker.js";
import {
  buildCaptureTicketData,
  canGenerateCaptureTicket,
  pokemonDbSpriteUrl,
  resolveCaptureTicketTheme
} from "../../domain/captureTicket.js";

function eligibleEncounter(overrides = {}) {
  return {
    captureResult: "success",
    speciesName: "Charizard",
    quality: "legendary",
    qualityMultiplier: 1.72,
    ivTotal: 189,
    isShiny: false,
    capturedByName: "Rhyxus",
    captureAtMs: 1787588515000,
    ...overrides
  };
}

test("capture.success normalizes captured_by_name", () => {
  const normalized = normalizeEvent("capture.success", {
    wild_monster_id: "wild-1",
    species_id: "charizard",
    species_name: "Charizard",
    captured_by_name: "Rhyxus",
    capsule_item_id: "capsule-ultra",
    capsule_name: "Ultra Ball",
    chance: 0.1,
    supply_cost: 130,
    auto_sold: false,
    auto_sell_value: 0
  });

  assert.equal(normalized.captured_by_name, "Rhyxus");
});

test("successful correlated encounter persists capturedByName", () => {
  const started = applyEvent(
    createTrackerState(),
    {
      type: "combat.started",
      socketId: "socket-1",
      seq: 1,
      ts: 1000,
      data: {
        enemy: {
          id: "wild-1",
          species_id: "charizard",
          level: 100,
          quality: "legendary",
          is_shiny: false,
          ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
          map_id: 1,
          zone_id: "zone-1",
          elements: ["fire", "flying"],
          gender: "male",
          nature: "adamant",
          quality_multiplier: 1.72
        },
        session: null
      }
    },
    () => "encounter-1"
  );

  const success = applyEvent(started.state, {
    type: "capture.success",
    socketId: "socket-1",
    seq: 2,
    ts: 2000,
    data: {
      wild_monster_id: "wild-1",
      species_id: "charizard",
      species_name: "Charizard",
      captured_by_name: "Rhyxus",
      capsule_item_id: "capsule-ultra",
      capsule_name: "Ultra Ball",
      chance: 0.1,
      supply_cost: 130,
      auto_sold: false,
      auto_sell_value: 0,
      creature: null
    }
  });

  const finalize = success.effects.find((effect) => effect.type === "encounter.finalize");
  assert.equal(finalize.patch.capturedByName, "Rhyxus");
});

test("ticket eligibility is successful Legend/Mythic/Shiny with complete new-capture data", () => {
  assert.equal(canGenerateCaptureTicket(eligibleEncounter()), true);
  assert.equal(canGenerateCaptureTicket(eligibleEncounter({ quality: "mythical" })), true);
  assert.equal(canGenerateCaptureTicket(eligibleEncounter({ quality: "common", isShiny: true })), true);
  assert.equal(canGenerateCaptureTicket(eligibleEncounter({ quality: "epic" })), false);
  assert.equal(canGenerateCaptureTicket(eligibleEncounter({ capturedByName: undefined })), false);
  assert.equal(canGenerateCaptureTicket(eligibleEncounter({ captureResult: "failed" })), false);
});

test("Shiny theme has priority over Mythical and Legendary", () => {
  assert.equal(resolveCaptureTicketTheme(eligibleEncounter({ quality: "mythical", isShiny: true })), "shiny");
  assert.equal(resolveCaptureTicketTheme(eligibleEncounter({ quality: "mythical" })), "mythic");
  assert.equal(resolveCaptureTicketTheme(eligibleEncounter()), "legend");
});

test("PokémonDB URL uses Black/White normal or shiny sprite", () => {
  assert.equal(
    pokemonDbSpriteUrl(eligibleEncounter()),
    "https://img.pokemondb.net/sprites/black-white/normal/charizard.png"
  );
  assert.equal(
    pokemonDbSpriteUrl(eligibleEncounter({ isShiny: true })),
    "https://img.pokemondb.net/sprites/black-white/shiny/charizard.png"
  );
});

test("ticket payload uses quality multiplier, IV total, player and timestamp", () => {
  const payload = buildCaptureTicketData(
    eligibleEncounter(),
    () => "2026-08-24 08:21:55"
  );

  assert.equal(payload.pokemonName, "CHARIZARD");
  assert.equal(payload.qualityLine, "QUALITY 1.72 · IV 189");
  assert.equal(payload.capturedBy, "CAPTURED BY RHYXUS");
  assert.equal(payload.timestamp, "2026-08-24 08:21:55");
});
