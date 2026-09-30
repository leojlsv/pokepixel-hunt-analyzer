import assert from "node:assert/strict";
import test from "node:test";
import {
  cardPresentationSnapshot,
  createCardPresentationCache,
  updateCardPresentationCache
} from "../../userscript/card-presentation.js";

test("card presentation exposes exactly one runtime-confirmed canonical active target", () => {
  const cache = createCardPresentationCache([{
    encounterId: "a",
    speciesId: "mr-mime",
    zoneId: "zone-7",
    level: 42,
    quality: "epic",
    isShiny: false,
    elements: ["psychic", "fairy"],
    pokemonExp: 4305,
    captureResult: "none",
    state: "started"
  }], { activeKeys: ["a"] });
  const snapshot = cardPresentationSnapshot(cache);
  assert.deepEqual(snapshot.currentTarget, {
    speciesId: "mr-mime",
    zoneId: "zone-7",
    species: "Mr Mime",
    level: 42,
    rarity: "epic",
    shiny: false,
    elements: ["psychic", "fairy"],
    pokemonExp: 4305
  });
});

test("repeated snapshots reuse the same immutable projection until the cache changes", () => {
  const cache = createCardPresentationCache([{
    encounterId: "a",
    speciesId: "dragonite",
    quality: "epic",
    captureResult: "success",
    captureAtMs: 1000,
    capsuleName: "Ultra Ball",
    gender: "male",
    nature: "bold",
    ivTotal: 120,
    ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 }
  }]);
  const first = cardPresentationSnapshot(cache);
  const second = cardPresentationSnapshot(cache);

  assert.equal(second, first);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.attemptHistory), true);
  assert.equal(Object.isFrozen(first.attemptHistory[0]), true);
  assert.equal(Object.isFrozen(first.attemptHistory[0].captureDetails), true);
  assert.equal(Object.isFrozen(first.attemptHistory[0].captureDetails.ivs), true);

  updateCardPresentationCache(cache, [{ speciesId: "missing-id", captureResult: "failed", captureAtMs: 1500 }]);
  assert.equal(cardPresentationSnapshot(cache), first, "ignored rows do not invalidate an unchanged cache");
});

test("a valid presentation update invalidates the memoized snapshot", () => {
  const cache = createCardPresentationCache([{
    encounterId: "a",
    speciesId: "dragonite",
    quality: "epic",
    captureResult: "failed",
    captureAtMs: 1000,
    capsuleName: "Ultra Ball"
  }]);
  const before = cardPresentationSnapshot(cache);

  updateCardPresentationCache(cache, [{
    encounterId: "a",
    speciesId: "dragonite",
    quality: "epic",
    captureResult: "success",
    captureAtMs: 2000,
    capsuleName: "Master Ball"
  }]);

  const after = cardPresentationSnapshot(cache);
  assert.notEqual(after, before);
  assert.equal(after.attemptHistory.length, 1);
  assert.equal(after.attemptHistory[0].atMs, 2000);
  assert.equal(after.attemptHistory[0].result, "captured");
  assert.equal(after.attemptHistory[0].ball, "Master Ball");
  assert.equal(cardPresentationSnapshot(cache), after, "the new snapshot is memoized after invalidation");
});

test("current target exposes only canonical element types and observed post-loot Pokemon XP", () => {
  const cache = createCardPresentationCache([{
    encounterId: "a",
    speciesId: "charizard",
    elements: ["fire", "flying", "invented", 42],
    pokemonExp: "4305",
    captureResult: "none",
    state: "started"
  }], { activeKeys: ["a"] });
  assert.deepEqual(cardPresentationSnapshot(cache).currentTarget.elements, ["fire", "flying"]);
  assert.equal(cardPresentationSnapshot(cache).currentTarget.pokemonExp, null, "string XP is not coerced");
});

test("card presentation fails closed when more than one active target exists", () => {
  const cache = createCardPresentationCache([
    { encounterId: "a", speciesId: "pikachu", captureResult: "none", state: "started" },
    { encounterId: "b", speciesId: "eevee", captureResult: "none", state: "looted" }
  ], { activeKeys: ["a", "b"] });
  assert.equal(cardPresentationSnapshot(cache).currentTarget, null);
});

test("persisted unresolved rows hydrate history state without becoming current targets", () => {
  const cache = createCardPresentationCache([
    { encounterId: "stale", speciesId: "mewtwo", captureResult: "none", state: "started" },
    { encounterId: "done", speciesId: "eevee", speciesName: "Eevee", quality: "rare", captureResult: "failed", captureAtMs: 500, state: "failed" }
  ]);
  const snapshot = cardPresentationSnapshot(cache);
  assert.equal(snapshot.currentTarget, null);
  assert.equal(snapshot.attemptHistory.length, 1);
  assert.equal(snapshot.attemptHistory[0].species, "Eevee");
});

test("live target provenance survives cache rebuild but stale persisted rows do not join it", () => {
  const live = { encounterId: "live", speciesId: "dragonite", zoneId: "zone-live", captureResult: "none", state: "started" };
  const stale = { encounterId: "stale", speciesId: "mewtwo", zoneId: "zone-stale", captureResult: "none", state: "started" };
  const first = updateCardPresentationCache(createCardPresentationCache([stale]), [live]);
  assert.equal(cardPresentationSnapshot(first).currentTarget?.speciesId, "dragonite");
  const rebuilt = createCardPresentationCache([stale, live], { activeKeys: first.liveActiveKeys });
  assert.equal(cardPresentationSnapshot(rebuilt).currentTarget?.speciesId, "dragonite");
  assert.deepEqual([...rebuilt.liveActiveKeys], ["live"]);
});

test("attempt history is all-rarity, bounded, newest-first, terminal-only and omits internal ids", () => {
  const qualities = ["weak", "common", "uncommon", "rare", "epic", "legendary", "mythical", "invented"];
  const rows = Array.from({ length: 40 }, (_, index) => ({
    encounterId: `attempt-${index}`,
    speciesId: "charizard",
    speciesName: "Charizard",
    quality: qualities[index % qualities.length],
    captureResult: index % 2 ? "success" : "failed",
    captureAtMs: 1000 + index,
    captureChance: index === 39 ? null : 0.02,
    qualityMultiplier: index === 39 ? 1.72 : index === 38 ? -1 : null,
    ivTotal: index === 39 ? 151 : index === 38 ? 176 : null,
    capsuleName: "Ultra Ball",
    isShiny: index === 38
  }));
  rows.push({ encounterId: "active", speciesId: "mew", quality: "rare", captureResult: "none", state: "started", captureAtMs: 5000 });
  const attempts = cardPresentationSnapshot(createCardPresentationCache(rows)).attemptHistory;
  assert.equal(attempts.length, 32);
  assert.equal(attempts[0].atMs, 1039);
  assert.equal(attempts[0].speciesId, "charizard");
  assert.equal(attempts[0].chance, null);
  assert.equal(attempts[0].qualityMultiplier, 1.72);
  assert.equal(attempts[0].result, "captured");
  assert.equal(attempts[0].ivTotal, 151);
  assert.equal(attempts[0].rarity, "unknown");
  assert.equal(attempts[0].ball, "Ultra Ball");
  assert.equal(attempts[1].result, "fled");
  assert.equal(attempts[1].ivTotal, 176, "failed attempts retain their authoritative total IV");
  assert.equal(attempts[1].captureDetails, null, "failed attempts still do not expose captured-only genetics");
  assert.equal("encounterId" in attempts[0], false);
  assert.equal("sessionId" in attempts[0], false);
  assert.equal("spriteUrl" in attempts[0], false, "attempt history does not expose unused sprite data");
  assert.ok(attempts.some((entry) => entry.rarity === "unknown"));
  assert.ok(attempts.some((entry) => entry.rarity === "epic"));
});

test("loot history is bounded, newest-first and exposes only canonical realized encounter value", () => {
  const rows = Array.from({ length: 40 }, (_, index) => ({
    encounterId: `loot-${index}`,
    sessionId: "hidden",
    speciesId: "meowth",
    speciesName: `Meowth ${index}`,
    lootAtMs: 1000 + index,
    gold: index === 39 ? 100 : 1,
    lootSellValue: index === 39 ? 25 : 2,
    autoSold: index === 39,
    autoSellValue: index === 39 ? 300 : 999,
    lootItems: index === 39
      ? [{ itemId: "reference_straw", qty: 3, name: "must-not-cross" }]
      : []
  }));
  rows.push({ encounterId: "no-loot", speciesId: "mew", gold: 9999 });

  const loot = cardPresentationSnapshot(createCardPresentationCache(rows)).lootHistory;
  assert.equal(loot.length, 32);
  assert.deepEqual(loot[0], {
    atMs: 1039,
    species: "Meowth 39",
    directGold: 100,
    lootSellValue: 25,
    autoSold: true,
    autoSellValue: 300,
    items: [{ itemId: "reference_straw", qty: 3 }],
    totalValue: 425
  });
  assert.equal(loot.at(-1).autoSellValue, 0, "unrealized auto-sell value never crosses the projection");
  assert.equal("encounterId" in loot[0], false);
  assert.equal("sessionId" in loot[0], false);
  assert.equal(Object.isFrozen(loot), true);
  assert.equal(Object.isFrozen(loot[0]), true);
  assert.equal(Object.isFrozen(loot[0].items), true);
  assert.equal(Object.isFrozen(loot[0].items[0]), true);
});

test("incremental loot history keeps the loot timestamp and adds realized auto-sell after capture", () => {
  const looted = {
    encounterId: "loot-capture",
    speciesId: "persian",
    speciesName: "Persian",
    lootAtMs: 1000,
    gold: 100,
    lootSellValue: 25,
    autoSold: false,
    autoSellValue: null,
    lootItems: [{ itemId: "reference_straw", qty: 2 }],
    captureResult: "none",
    state: "looted"
  };
  const cache = createCardPresentationCache([looted]);
  assert.equal(cardPresentationSnapshot(cache).lootHistory[0].totalValue, 125);

  updateCardPresentationCache(cache, [{
    ...looted,
    captureAtMs: 1200,
    captureResult: "success",
    autoSold: true,
    autoSellValue: 250,
    state: "captured"
  }]);

  assert.deepEqual(cardPresentationSnapshot(cache).lootHistory[0], {
    atMs: 1000,
    species: "Persian",
    directGold: 100,
    lootSellValue: 25,
    autoSold: true,
    autoSellValue: 250,
    items: [{ itemId: "reference_straw", qty: 2 }],
    totalValue: 375
  });
});

test("special history retains older Shiny/Epic despite normal attempts", () => {
  const special = {
    encounterId: "old-special",
    speciesId: "umbreon",
    speciesName: "Umbreon",
    quality: "epic",
    captureResult: "success",
    captureAtMs: 1_000,
    captureChance: 0.01,
    capsuleName: "Master Ball",
    isShiny: true,
    qualityMultiplier: 1.72
  };
  const normal = Array.from({ length: 80 }, (_, index) => ({
    encounterId: `normal-${index}`,
    speciesId: "rattata",
    speciesName: "Rattata",
    quality: index % 2 ? "common" : "rare",
    captureResult: "failed",
    captureAtMs: 2_000 + index,
    captureChance: 0.5,
    capsuleName: "Ultra Ball",
    isShiny: false
  }));
  normal.push({
    encounterId: "rare-shiny",
    speciesId: "ditto",
    speciesName: "Ditto",
    quality: "rare",
    captureResult: "failed",
    captureAtMs: 3_000,
    captureChance: 0.02,
    capsuleName: "Ultra Ball",
    isShiny: true
  });
  const snapshot = cardPresentationSnapshot(createCardPresentationCache([special, ...normal]));
  assert.equal(snapshot.attemptHistory.length, 32, "legacy generic history stays bounded");
  assert.equal(snapshot.attemptHistory.some((entry) => entry.species === "Umbreon"), false, "legacy cap still evicts the old row");
  assert.deepEqual(snapshot.specialHistory.map((entry) => entry.species), ["Ditto", "Umbreon"]);
  assert.equal(snapshot.specialHistory[1].shiny, true);
  assert.equal(snapshot.specialHistory[1].rarity, "epic");
  assert.equal(snapshot.specialHistory[1].speciesId, "umbreon");
  assert.equal(snapshot.specialHistory[1].qualityMultiplier, 1.72);
});

test("special history bounds the newest special entries independently from normal attempts", () => {
  const special = Array.from({ length: 48 }, (_, index) => ({
    encounterId: `special-${index}`,
    speciesId: "umbreon",
    quality: index % 2 ? "epic" : "rare",
    isShiny: index % 2 === 0,
    captureResult: "failed",
    captureAtMs: 1000 + index
  }));
  const normal = Array.from({ length: 80 }, (_, index) => ({
    encounterId: `normal-${index}`,
    speciesId: "rattata",
    quality: "common",
    captureResult: "failed",
    captureAtMs: 2000 + index
  }));
  const cache = createCardPresentationCache([...special, ...normal]);
  const history = cardPresentationSnapshot(cache);

  assert.equal(cache.attemptHistory.size, 32, "ordinary attempts must not accumulate in memory");
  assert.equal(cache.specialHistory.size, 32, "special attempts must not accumulate in memory");
  assert.equal(history.specialHistory.length, 32);
  assert.equal(history.specialHistory[0].atMs, 1047);
  assert.equal(history.specialHistory.at(-1).atMs, 1016);
  assert.equal(history.attemptHistory.length, 32);
  assert.equal(history.attemptHistory.some((entry) => entry.species === "Umbreon"), false);
});

test("incremental card cache retains the same bounded newest rows after out-of-order events", () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({
    encounterId: `event-${index}`,
    speciesId: "pidgey",
    quality: index % 3 ? "common" : "legendary",
    captureResult: "failed",
    captureAtMs: 1_000 + index,
    lootAtMs: 2_000 + index,
    gold: index
  }));
  const cache = createCardPresentationCache();
  for (const row of [...rows].reverse()) updateCardPresentationCache(cache, [row]);

  assert.deepEqual(cardPresentationSnapshot(cache), cardPresentationSnapshot(createCardPresentationCache(rows)));
  assert.equal(cache.attemptHistory.size, 32);
  assert.equal(cache.specialHistory.size, 32);
  assert.equal(cache.lootHistory.size, 32);
});

test("incremental presentation cache moves a target into all-rarity history on terminal update", () => {
  const cache = createCardPresentationCache([{
    encounterId: "x",
    speciesId: "dragonite",
    level: 60,
    quality: "epic",
    captureResult: "none",
    state: "started"
  }], { activeKeys: ["x"] });
  updateCardPresentationCache(cache, [{
    encounterId: "x",
    speciesId: "dragonite",
    speciesName: "Dragonite",
    level: 60,
    quality: "epic",
    captureResult: "failed",
    captureAtMs: 2000,
    captureChance: 0.01,
    capsuleName: "Master Ball",
    state: "failed"
  }]);
  const snapshot = cardPresentationSnapshot(cache);
  assert.equal(snapshot.currentTarget, null);
  assert.equal(snapshot.attemptHistory.length, 1);
  assert.equal(snapshot.attemptHistory[0].species, "Dragonite");
  assert.equal(snapshot.attemptHistory[0].rarity, "epic");
  assert.equal(snapshot.specialHistory[0].species, "Dragonite");
});

test("captured attempt exposes bounded gender, nature and six detailed IVs while fled attempts do not", () => {
  const captured = {
    encounterId: "captured",
    speciesId: "pidgey",
    speciesName: "Pidgey",
    quality: "epic",
    captureResult: "success",
    captureAtMs: 3000,
    capsuleName: "Ultra Ball",
    gender: "male",
    nature: "bold",
    ivTotal: 103,
    ivs: { hp: 20, atk: 14, def: 8, spa: 17, spd: 27, spe: 17 }
  };
  const fled = { ...captured, encounterId: "fled", captureResult: "failed", captureAtMs: 2000 };
  const snapshot = cardPresentationSnapshot(createCardPresentationCache([captured, fled]));
  assert.deepEqual(snapshot.specialHistory[0].captureDetails, {
    gender: "male",
    nature: "bold",
    ivTotal: 103,
    ivs: { hp: 20, atk: 14, def: 8, spa: 17, spd: 27, spe: 17 }
  });
  assert.equal(snapshot.specialHistory[1].captureDetails, null);
  assert.equal(Object.isFrozen(snapshot.specialHistory[0].captureDetails), true);
  assert.equal(Object.isFrozen(snapshot.specialHistory[0].captureDetails.ivs), true);
});
