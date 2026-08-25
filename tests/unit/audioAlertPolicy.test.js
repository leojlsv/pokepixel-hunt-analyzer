import { test } from "node:test";
import assert from "node:assert/strict";

import {
  defaultAudioAlertSettings,
  selectAudioAlertKey
} from "../../domain/audioAlertPolicy.js";

test("audio alert settings default to all disabled", () => {
  const settings = defaultAudioAlertSettings();
  assert.equal(Object.values(settings).filter(Boolean).length, 0);
  assert.equal(Object.keys(settings).length, 8);
});

test("Shiny alert wins over notable rarity when both are enabled", () => {
  const settings = defaultAudioAlertSettings();
  settings.shiny_fled = true;
  settings.legendary_fled = true;

  assert.equal(
    selectAudioAlertKey({ result: "fled", rarity: "legendary", isShiny: true }, settings),
    "shiny_fled"
  );
});

test("notable rarity is the fallback when matching Shiny alert is disabled", () => {
  const settings = defaultAudioAlertSettings();
  settings.legendary_captured = true;

  assert.equal(
    selectAudioAlertKey({ result: "captured", rarity: "legendary", isShiny: true }, settings),
    "legendary_captured"
  );
});

test("Mythical protocol rarity maps to the mythic sound key", () => {
  const settings = defaultAudioAlertSettings();
  settings.mythic_fled = true;

  assert.equal(
    selectAudioAlertKey({ result: "fled", rarity: "mythical", isShiny: false }, settings),
    "mythic_fled"
  );
});

test("ordinary non-Shiny encounters do not select a sound", () => {
  const settings = defaultAudioAlertSettings();
  settings.epic_captured = true;
  settings.shiny_captured = true;

  assert.equal(
    selectAudioAlertKey({ result: "captured", rarity: "common", isShiny: false }, settings),
    null
  );
});
