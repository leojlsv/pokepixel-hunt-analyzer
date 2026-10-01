import assert from "node:assert/strict";
import test from "node:test";
import {
  EMBED_MARKER_GLOBAL,
  PUBLIC_CONTROL_GLOBAL,
  PUBLIC_SUMMARY_GLOBAL,
  PUBLIC_SUMMARY_PROTOCOL,
  createPublicSummary,
  installPublicSessionControl,
  installPublicSummaryBridge,
  isEmbedMode
} from "../../userscript/public-summary.js";

test("public summary exposes only bounded current analytics state", () => {
  const summary = createPublicSummary({
    appVersion: "1.13.0",
    leadershipActive: true,
    now: 1234,
    currentState: {
      metrics: {
        status: "running",
        startedAtMs: 100,
        activeMs: 120000,
        seen: 42,
        seenPerHour: 1260,
        captured: 17,
        failed: 25,
        seenToCaptureRate: 17 / 42,
        trainerExp: 5000,
        trainerExpPerHour: 150000,
        pokemonExp: 7000,
        pokemonExpPerHour: 210000,
        directGold: 7000,
        lootSellValue: 2345,
        autoSellValue: 3000,
        revenue: 12345,
        revenuePerHour: 370350,
        gold: 12345,
        goldPerHour: 370350,
        expenses: 900,
        expensesPerHour: 27000,
        profit: 11445,
        profitPerHour: 343350,
        rarePlusFailed: 3,
        epicPlusFailed: 2,
        shiny: { seen: 2, captured: 1 },
        rarities: {
          unknown: { seen: 2, captured: 1, shinySeen: 1, shinyCaptured: 1 },
          weak: { seen: 4, captured: 2 },
          common: { seen: 8, captured: 3 },
          uncommon: { seen: 10, captured: 4 },
          rare: { seen: 7, captured: 2 },
          epic: { seen: 6, captured: 2, shinySeen: 1 },
          legendary: { seen: 4, captured: 1 },
          mythical: { seen: 3, captured: 1 }
        }
      },
      latestCaptureAttempt: { chance: 0.033936651583710405, atMs: 1200, tieKey: "mewtwo" }
    }
  });

  assert.deepEqual(summary, {
    protocol: 1,
    appVersion: "1.13.0",
    capturedAtMs: 1234,
    available: true,
    leadershipActive: true,
    status: "running",
    sessionGeneration: null,
    activityKind: "hunt",
    startedAtMs: 100,
    endedAtMs: null,
    activeMs: 120000,
    seen: 42,
    seenPerHour: 1260,
    captured: 17,
    failed: 25,
    captureRate: 17 / 42,
    trainerExp: 5000,
    trainerExpPerHour: 150000,
    pokemonExp: 7000,
    pokemonExpPerHour: 210000,
    directGold: 7000,
    lootSellValue: 2345,
    autoSellValue: 3000,
    revenue: 12345,
    revenuePerHour: 370350,
    dollar: 12345,
    dollarPerHour: 370350,
    expenses: 900,
    expensesPerHour: 27000,
    profit: 11445,
    profitPerHour: 343350,
    rarePlusFailed: 3,
    epicPlusFailed: 2,
    shinySeen: 2,
    shinyCaptured: 1,
    seenUnknown: 2,
    seenWeak: 4,
    seenCommon: 8,
    seenUncommon: 10,
    seenRare: 7,
    seenEpic: 6,
    seenLegendary: 4,
    seenMythical: 3,
    rarityCounts: {
      unknown: { captured: 1, seen: 2, shinyCaptured: 1, shinySeen: 1 },
      weak: { captured: 2, seen: 4, shinyCaptured: 0, shinySeen: 0 },
      common: { captured: 3, seen: 8, shinyCaptured: 0, shinySeen: 0 },
      uncommon: { captured: 4, seen: 10, shinyCaptured: 0, shinySeen: 0 },
      rare: { captured: 2, seen: 7, shinyCaptured: 0, shinySeen: 0 },
      epic: { captured: 2, seen: 6, shinyCaptured: 0, shinySeen: 1 },
      legendary: { captured: 1, seen: 4, shinyCaptured: 0, shinySeen: 0 },
      mythical: { captured: 1, seen: 3, shinyCaptured: 0, shinySeen: 0 }
    },
    latestCaptureChance: 0.033936651583710405,
    currentTarget: null,
    currentSessionSpecies: null,
    attemptHistory: [],
    specialHistory: [],
    lootHistory: [],
    epicAttempts: []
  });
  assert.equal(Object.isFrozen(summary), true);
  assert.equal("sessionId" in summary, false);
  assert.equal("encounters" in summary, false);
});

test("public CURRENT-session species follows latestSpeciesEncounter without promoting terminal rows to live", () => {
  const older = { encounterId: "previous", speciesId: "eevee", speciesName: "eevee", startedAtMs: 300, captureAtMs: 350, captureResult: "failed" };
  const latest = { encounterId: "current", speciesId: "mr_mime", speciesName: "mr mime", startedAtMs: 100, captureAtMs: 700, captureResult: "success", zoneId: "zone-secret", secret: "must-not-cross" };
  const currentState = { sessionId: "current-hunt", metrics: { status: "paused", activityKind: "hunt" }, encounters: [latest, older] };
  const summary = createPublicSummary({ currentState, now: 800 });
  assert.deepEqual(summary.currentSessionSpecies, { speciesId: "mr_mime", species: "Mr Mime" });
  assert.equal(summary.currentTarget, null, "past encounter remains distinct from canonical live target");
  assert.equal(Object.isFrozen(summary.currentSessionSpecies), true);
  assert.equal("encounterId" in summary.currentSessionSpecies, false);
  assert.equal("zoneId" in summary.currentSessionSpecies, false);
  assert.equal(JSON.stringify(summary).includes("must-not-cross"), false);
  assert.equal(createPublicSummary({ currentState: { ...currentState, metrics: { status: "running", activityKind: "expedition" } } }).currentSessionSpecies, null,
    "expedition running shows EXPEDITION in CURRENT, not a Hunt species");
  assert.equal(createPublicSummary({ currentState: { ...currentState, encounters: [] } }).currentSessionSpecies, null,
    "a new session without encounters cannot inherit the previous session's last species");
  assert.deepEqual(createPublicSummary({ currentState: { ...currentState, currentSessionSpecies: older } }).currentSessionSpecies,
    { speciesId: "eevee", species: "Eevee" }, "runtime can reuse its cached session projection on timer-only refreshes");
  assert.equal(createPublicSummary({ currentState: { ...currentState, currentSessionSpecies: null } }).currentSessionSpecies, null,
    "an explicitly empty cache never reads the old encounter rows to resurrect a species");
  assert.equal(createPublicSummary({}).currentSessionSpecies, null);
});

test("public CURRENT boundary carries opaque session generation and lifecycle timestamps, never local or server IDs", () => {
  const id = "private-local-session-uuid";
  const first = createPublicSummary({ currentState: {
    sessionId: id, sessionGeneration: 7, endedAtMs: null,
    metrics: { status: "running", activityKind: "hunt", startedAtMs: 1200 },
  }, now: 2000 });
  assert.equal(first.sessionGeneration, 7);
  assert.equal(first.activityKind, "hunt");
  assert.equal(first.startedAtMs, 1200);
  assert.equal(first.endedAtMs, null);
  assert.equal("sessionId" in first, false);
  assert.equal("activityInstanceId" in first, false);
  assert.equal(JSON.stringify(first).includes(id), false);

  const ended = createPublicSummary({ currentState: {
    sessionId: id, sessionGeneration: 7, endedAtMs: 3000,
    metrics: { status: "waiting", activityKind: "hunt", startedAtMs: 1200 },
  }, now: 3000 });
  assert.equal(ended.sessionGeneration, first.sessionGeneration, "ending does not rotate the same session");
  assert.equal(ended.status, "waiting");
  assert.equal(ended.endedAtMs, 3000);

  const expedition = createPublicSummary({ currentState: {
    sessionId: "another-local-uuid", sessionGeneration: 8,
    metrics: { status: "running", activityKind: "expedition", startedAtMs: 3500 },
    cardPresentation: { currentTarget: { speciesId: "pikachu", species: "Pikachu", level: 20 } },
  }, now: 4000 });
  assert.equal(expedition.sessionGeneration, 8);
  assert.equal(expedition.activityKind, "expedition");
  assert.equal(expedition.currentTarget, null, "CURRENT displays EXPEDITION, not a live Hunt target");
  assert.equal(expedition.currentSessionSpecies, null);
  assert.equal("sessionId" in expedition, false);
  assert.equal(createPublicSummary({ currentState: { metrics: { status: "running" }, sessionGeneration: 1.5 } }).sessionGeneration, null,
    "a malformed generation is never exported");
});

test("public summary fails closed before Current state is hydrated", () => {
  const summary = createPublicSummary({ appVersion: "1.13.0", now: 10 });
  assert.equal(summary.available, false);
  assert.equal(summary.status, "waiting");
  assert.equal(summary.seen, 0);
  assert.equal(summary.captureRate, null);
  assert.equal(summary.seenUnknown, 0);
  assert.equal(summary.seenLegendary, 0);
  assert.equal(summary.latestCaptureChance, null);
});

test("public summary derives only bounded aggregate rarity and latest-attempt details", () => {
  const summary = createPublicSummary({
    appVersion: "1.13.0",
    currentState: {
      metrics: {
        status: "running",
        rarities: { unknown: { seen: 3 }, rare: { seen: -2 }, legendary: { seen: 4 } }
      },
      latestCaptureAttempt: { chance: 0.004, atMs: 20, tieKey: "zapdos" }
    }
  });

  assert.equal(summary.seenUnknown, 3);
  assert.equal(summary.seenRare, 0);
  assert.equal(summary.seenLegendary, 4);
  assert.equal(summary.latestCaptureChance, 0.004);
  assert.equal("rarities" in summary, false);
  assert.equal("encounters" in summary, false);
});

test("public summary never coerces absent latest chance into a real zero-percent attempt", () => {
  for (const chance of [null, undefined, "", "0", NaN, Infinity, -0.1, 1.1]) {
    const summary = createPublicSummary({
      currentState: {
        metrics: { status: "running" },
        latestCaptureAttempt: { chance }
      }
    });
    assert.equal(summary.latestCaptureChance, null);
  }
  assert.equal(createPublicSummary({
    currentState: { metrics: { status: "running" }, latestCaptureAttempt: { chance: 0 } }
  }).latestCaptureChance, 0, "numeric zero remains a valid server-provided chance");
});

test("public summary preserves nullable aggregate rates instead of coercing them to zero", () => {
  const summary = createPublicSummary({
    currentState: {
      metrics: {
        status: "running",
        seenToCaptureRate: null,
        seenPerHour: null,
        trainerExpPerHour: null,
        pokemonExpPerHour: null,
        goldPerHour: null
      }
    }
  });
  assert.equal(summary.captureRate, null);
  assert.equal(summary.seenPerHour, null);
  assert.equal(summary.trainerExpPerHour, null);
  assert.equal(summary.pokemonExpPerHour, null);
  assert.equal(summary.dollarPerHour, null);
});

test("public summary strictly allowlists bounded all-rarity card presentation data", () => {
  const attemptHistory = [
    { atMs: -1, species: "invalid time", result: "fled", ball: "Ball" },
    { atMs: 10, species: "", result: "captured", ball: "Ball" },
    { atMs: 11, species: "invalid result", result: "unknown", ball: "Ball" },
    ...Array.from({ length: 10 }, (_, index) => ({
      atMs: 100 + index,
      speciesId: `charizard-${index}${"q".repeat(80)}`,
      species: `Attempt ${index + 1}${"x".repeat(80)}`,
      rarity: index % 2 ? "rare" : "epic",
      qualityMultiplier: index === 0 ? 1.72 : index === 1 ? -1 : index === 2 ? Infinity : null,
      shiny: index === 2,
      chance: index === 0 ? "0.5" : index === 1 ? 2 : 0.02,
      result: index % 2 ? "captured" : "fled",
      ivTotal: index === 0 ? 176 : index === 1 ? 151 : index === 2 ? 999 : null,
      ball: `Ultra Ball ${"y".repeat(80)}`,
      encounterId: "must-not-cross",
      sessionId: "must-not-cross",
      spriteUrl: "https://evil.example/epic.png"
    }))
  ];
  const summary = createPublicSummary({
    now: 1000,
    currentState: {
      metrics: { status: "running", rarities: { epic: { seen: 3, captured: 1, shinySeen: 1, shinyCaptured: 1 } } },
      cardPresentation: {
        currentTarget: {
          speciesId: `charizard${"q".repeat(80)}`,
          zoneId: `zone${"w".repeat(80)}`,
          species: `Charizard${"z".repeat(80)}`,
          level: 90.9,
          rarity: "invented",
          shiny: "yes",
          elements: ["fire", "flying", "invented"],
          pokemonExp: 4305,
          encounterId: "must-not-cross",
          chance: 0.99
        },
        attemptHistory,
        specialHistory: [
          attemptHistory[3],
          { atMs: 500, species: "Old shiny", rarity: "rare", shiny: true, chance: 0.03, result: "captured", ball: "Ultra Ball", encounterId: "hidden",
            captureDetails: { gender: "female", nature: "adamant", ivTotal: 151, ivs: { hp: 31, atk: 31, def: 25, spa: 20, spd: 22, spe: 22 }, secret: "hidden" } }
        ]
      }
    }
  });

  assert.equal(summary.currentTarget.species.length, 64);
  assert.equal(summary.currentTarget.speciesId.length, 64);
  assert.equal(summary.currentTarget.zoneId.length, 64);
  assert.equal(summary.currentTarget.level, 90);
  assert.equal(summary.currentTarget.rarity, "");
  assert.equal(summary.currentTarget.shiny, null);
  assert.deepEqual(summary.currentTarget.elements, ["fire", "flying"]);
  assert.equal(summary.currentTarget.pokemonExp, 4305);
  assert.equal("spriteUrl" in summary.currentTarget, false);
  assert.equal("encounterId" in summary.currentTarget, false);
  assert.equal("chance" in summary.currentTarget, false, "current target never gains a prospective chance");
  assert.equal(summary.attemptHistory.length, 10);
  assert.equal(summary.attemptHistory[0].atMs, 100);
  assert.equal(summary.attemptHistory[0].speciesId.length, 64);
  assert.equal(summary.attemptHistory[0].qualityMultiplier, 1.72);
  assert.equal(summary.attemptHistory[0].chance, null, "string chance is not coerced");
  assert.equal(summary.attemptHistory[0].ivTotal, 176, "failed total IV remains in the bounded public attempt projection");
  assert.equal(summary.attemptHistory[1].chance, null, "out-of-range chance fails closed");
  assert.equal(summary.attemptHistory[1].ivTotal, 151);
  assert.equal(summary.attemptHistory[1].qualityMultiplier, null);
  assert.equal(summary.attemptHistory[2].qualityMultiplier, null);
  assert.equal(summary.attemptHistory[2].ivTotal, null, "out-of-range total IV fails closed");
  assert.equal(summary.attemptHistory[0].species.length, 64);
  assert.equal(summary.attemptHistory[0].ball.length, 32);
  assert.equal(summary.attemptHistory[0].rarity, "epic");
  assert.equal(summary.attemptHistory[2].shiny, true);
  assert.equal("encounterId" in summary.attemptHistory[0], false);
  assert.equal("sessionId" in summary.attemptHistory[0], false);
  assert.equal("spriteUrl" in summary.attemptHistory[0], false);
  assert.equal(summary.epicAttempts.length, 5, "protocol-v1 Epic compatibility is derived from the all-rarity projection");
  assert.equal(summary.specialHistory.length, 2);
  assert.equal(summary.specialHistory[0].speciesId.length, 64);
  assert.equal(summary.specialHistory[0].qualityMultiplier, 1.72);
  assert.equal(summary.specialHistory[1].species, "Old shiny");
  assert.deepEqual(summary.specialHistory[1].captureDetails, {
    gender: "female", nature: "adamant", ivTotal: 151,
    ivs: { hp: 31, atk: 31, def: 25, spa: 20, spd: 22, spe: 22 }
  });
  assert.equal("secret" in summary.specialHistory[1].captureDetails, false);
  assert.equal("encounterId" in summary.specialHistory[1], false);
  assert.equal(Object.isFrozen(summary.currentTarget), true);
  assert.equal(Object.isFrozen(summary.attemptHistory), true);
  assert.equal(Object.isFrozen(summary.attemptHistory[0]), true);
  assert.equal(Object.isFrozen(summary.specialHistory), true);
  assert.equal(Object.isFrozen(summary.specialHistory[0]), true);
  assert.equal(Object.isFrozen(summary.specialHistory[1].captureDetails), true);
  assert.equal(Object.isFrozen(summary.specialHistory[1].captureDetails.ivs), true);
  assert.equal(Object.isFrozen(summary.epicAttempts), true);
  assert.equal(Object.isFrozen(summary.epicAttempts[0]), true);
});

test("public summary strictly allowlists and recalculates bounded loot history", () => {
  const lootHistory = [
    { atMs: -1, species: "invalid", directGold: 1 },
    { atMs: 10, species: "", directGold: 1 },
    {
      atMs: 20,
      species: `Persian${"x".repeat(80)}`,
      directGold: -50,
      lootSellValue: 25,
      autoSold: false,
      autoSellValue: 999,
      totalValue: 999999,
      encounterId: "hidden",
      sessionId: "hidden",
      items: [
        { itemId: `reference_${"x".repeat(80)}`, qty: 3.9, name: "must-not-cross", rarity: "rare", value: 999 },
        { itemId: "negative", qty: -1 },
        { itemId: "", qty: 2 }
      ]
    },
    {
      atMs: 21,
      species: "Meowth",
      directGold: 1e16,
      lootSellValue: Infinity,
      autoSold: true,
      autoSellValue: 300
    },
    ...Array.from({ length: 35 }, (_, index) => ({
      atMs: 100 + index,
      species: `Loot ${index}`,
      directGold: 1,
      lootSellValue: 2,
      autoSold: false,
      autoSellValue: 500
    }))
  ];
  const summary = createPublicSummary({
    currentState: {
      metrics: { status: "running" },
      cardPresentation: { lootHistory }
    }
  });

  assert.equal(summary.lootHistory.length, 32);
  assert.deepEqual(summary.lootHistory[0], {
    atMs: 20,
    species: `Persian${"x".repeat(57)}`,
    directGold: 0,
    lootSellValue: 25,
    autoSold: false,
    autoSellValue: 0,
    items: [{ itemId: `reference_${"x".repeat(54)}`, qty: 3 }],
    totalValue: 25
  });
  assert.deepEqual(summary.lootHistory[1], {
    atMs: 21,
    species: "Meowth",
    directGold: 1e15,
    lootSellValue: 0,
    autoSold: true,
    autoSellValue: 300,
    items: [],
    totalValue: 1e15
  });
  assert.equal("encounterId" in summary.lootHistory[0], false);
  assert.equal("sessionId" in summary.lootHistory[0], false);
  assert.equal("name" in summary.lootHistory[0].items[0], false);
  assert.equal("rarity" in summary.lootHistory[0].items[0], false);
  assert.equal("value" in summary.lootHistory[0].items[0], false);
  assert.equal(Object.isFrozen(summary.lootHistory), true);
  assert.equal(Object.isFrozen(summary.lootHistory[0]), true);
  assert.equal(Object.isFrozen(summary.lootHistory[0].items), true);
  assert.equal(Object.isFrozen(summary.lootHistory[0].items[0]), true);
});

test("unavailable public summary drops stale card presentation data", () => {
  const summary = createPublicSummary({
    currentState: {
      cardPresentation: {
        currentTarget: { species: "Mew", level: 50 },
        attemptHistory: [{ atMs: 1, species: "Dragonite", rarity: "epic", result: "fled", ball: "Ultra Ball" }]
      }
    }
  });
  assert.equal(summary.available, false);
  assert.equal(summary.currentTarget, null);
  assert.deepEqual(summary.attemptHistory, []);
  assert.deepEqual(summary.specialHistory, []);
  assert.deepEqual(summary.lootHistory, []);
  assert.deepEqual(summary.epicAttempts, []);
});

test("public summary independently caps special history from a large presentation", () => {
  const specialHistory = Array.from({ length: 1000 }, (_, index) => ({
    atMs: 1000 - index,
    species: `Eevee ${index}`,
    rarity: "epic",
    result: "fled",
    chance: 0.2
  }));
  const summary = createPublicSummary({
    currentState: {
      metrics: { status: "running" },
      cardPresentation: { specialHistory }
    }
  });

  assert.equal(summary.specialHistory.length, 32);
  assert.equal(summary.specialHistory[0].atMs, 1000);
  assert.equal(summary.specialHistory.at(-1).atMs, 969);
  const pageWindow = {};
  const dispose = installPublicSummaryBridge({ pageWindow, getSummary: () => summary });
  assert.equal(pageWindow[PUBLIC_SUMMARY_GLOBAL].getSummary().specialHistory.length, 32);
  dispose();
});

test("embed marker requires the exact public protocol", () => {
  const pageWindow = {};
  assert.equal(isEmbedMode(pageWindow), false);
  pageWindow[EMBED_MARKER_GLOBAL] = { protocol: 99 };
  assert.equal(isEmbedMode(pageWindow), false);
  pageWindow[EMBED_MARKER_GLOBAL] = { protocol: PUBLIC_SUMMARY_PROTOCOL };
  assert.equal(isEmbedMode(pageWindow), true);
});

test("public bridge publishes a read-only snapshot provider and cleans up ownership", () => {
  const pageWindow = {};
  let reads = 0;
  let current = createPublicSummary({
    appVersion: "1.13.0",
    now: 1,
    currentState: {
      metrics: { status: "running", rarities: { epic: { seen: 3, captured: 1, shinySeen: 1, shinyCaptured: 1 } } },
      cardPresentation: {
        currentTarget: {
          speciesId: "charizard",
          zoneId: "volcano",
          species: "Charizard",
          level: 90,
          rarity: "epic",
          shiny: false,
          elements: ["fire", "flying"],
          pokemonExp: 4305
        },
        attemptHistory: [{
          atMs: 1,
          species: "Dragonite",
          rarity: "epic",
          chance: 0.01,
          result: "fled",
          ball: "Ultra Ball"
        }],
        specialHistory: [{
          atMs: 1,
          species: "Dragonite",
          rarity: "epic",
          shiny: true,
          chance: 0.01,
          result: "fled",
          ball: "Ultra Ball"
        }, {
          atMs: 2,
          species: "Umbreon",
          rarity: "epic",
          shiny: false,
          chance: 0.01,
          result: "captured",
          ball: "Ultra Ball",
          captureDetails: { gender: "male", nature: "careful", ivTotal: 120, ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 } }
        }],
        lootHistory: [{
          atMs: 3,
          species: "Meowth",
          directGold: 100,
          lootSellValue: 20,
          autoSold: true,
          autoSellValue: 250,
          items: [{ itemId: "reference_straw", qty: 3 }],
          totalValue: 370
        }]
      }
    }
  });
  const cleanup = installPublicSummaryBridge({
    pageWindow,
    appVersion: "1.13.0",
    getSummary: () => current,
    onRead: () => { reads += 1; }
  });

  const api = pageWindow[PUBLIC_SUMMARY_GLOBAL];
  assert.equal(api.protocol, 1);
  assert.equal(api.appVersion, "1.13.0");
  const first = api.getSummary();
  assert.equal(reads, 1);
  assert.deepEqual(first, current);
  assert.notEqual(first, current, "callers receive a copy rather than the owned snapshot");
  assert.notEqual(first.currentTarget, current.currentTarget);
  assert.notEqual(first.attemptHistory, current.attemptHistory);
  assert.notEqual(first.attemptHistory[0], current.attemptHistory[0]);
  assert.notEqual(first.specialHistory, current.specialHistory);
  assert.notEqual(first.specialHistory[0], current.specialHistory[0]);
  assert.notEqual(first.specialHistory[1].captureDetails, current.specialHistory[1].captureDetails);
  assert.notEqual(first.specialHistory[1].captureDetails.ivs, current.specialHistory[1].captureDetails.ivs);
  assert.notEqual(first.lootHistory, current.lootHistory);
  assert.notEqual(first.lootHistory[0], current.lootHistory[0]);
  assert.notEqual(first.lootHistory[0].items, current.lootHistory[0].items);
  assert.notEqual(first.lootHistory[0].items[0], current.lootHistory[0].items[0]);
  assert.notEqual(first.rarityCounts, current.rarityCounts);
  assert.notEqual(first.rarityCounts.epic, current.rarityCounts.epic);
  assert.notEqual(first.epicAttempts, current.epicAttempts);
  assert.notEqual(first.epicAttempts[0], current.epicAttempts[0]);
  first.currentTarget.species = "Mutated";
  first.attemptHistory[0].species = "Mutated all";
  first.attemptHistory.push({ atMs: 2, species: "Injected all", result: "captured" });
  first.specialHistory[0].species = "Mutated special";
  first.specialHistory[1].captureDetails.ivs.hp = 0;
  first.specialHistory.push({ atMs: 2, species: "Injected special", rarity: "epic", result: "captured" });
  first.lootHistory[0].totalValue = 0;
  first.lootHistory[0].items[0].qty = 0;
  first.lootHistory.push({ atMs: 4, species: "Injected loot", totalValue: 999 });
  first.rarityCounts.epic.seen = 999;
  first.epicAttempts[0].species = "Mutated";
  first.epicAttempts.push({ atMs: 2, species: "Injected", result: "captured" });
  assert.equal(api.getSummary().currentTarget.species, "Charizard");
  assert.equal(api.getSummary().attemptHistory.length, 1);
  assert.equal(api.getSummary().attemptHistory[0].species, "Dragonite");
  assert.equal(api.getSummary().specialHistory.length, 2);
  assert.equal(api.getSummary().specialHistory[0].species, "Dragonite");
  assert.equal(api.getSummary().specialHistory[1].captureDetails.ivs.hp, 20);
  assert.equal(api.getSummary().lootHistory.length, 1);
  assert.equal(api.getSummary().lootHistory[0].totalValue, 370);
  assert.equal(api.getSummary().lootHistory[0].items[0].qty, 3);
  assert.equal(api.getSummary().rarityCounts.epic.seen, 3);
  assert.equal(api.getSummary().epicAttempts.length, 1);
  assert.equal(api.getSummary().epicAttempts[0].species, "Dragonite");
  assert.equal(reads, 13);

  current = createPublicSummary({
    appVersion: "1.13.0",
    now: 2,
    currentState: { metrics: { status: "paused", seen: 4 } }
  });
  assert.equal(api.getSummary().status, "paused");
  assert.equal(api.getSummary().seen, 4);
  assert.equal(reads, 15);

  cleanup();
  assert.equal(pageWindow[PUBLIC_SUMMARY_GLOBAL], undefined);
});

test("paused public summary suppresses a stale current target while preserving history", () => {
  const summary = createPublicSummary({
    now: 50,
    currentState: {
      metrics: { status: "paused" },
      cardPresentation: {
        currentTarget: { speciesId: "mew", species: "Mew", level: 50, rarity: "mythical", shiny: false },
        attemptHistory: [{ atMs: 40, species: "Eevee", rarity: "rare", result: "fled", ball: "Ultra Ball" }]
      }
    }
  });
  assert.equal(summary.currentTarget, null);
  assert.equal(summary.attemptHistory.length, 1);
});

test("public session control exposes only pause resume reset and cleans up", async () => {
  const pageWindow = {};
  const actions = [];
  const cleanup = installPublicSessionControl({
    pageWindow,
    performAction: async action => { actions.push(action); return action !== "resume"; }
  });
  const api = pageWindow[PUBLIC_CONTROL_GLOBAL];
  assert.equal(api.protocol, 1);
  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(await api.act("pause"), { ok: true });
  assert.deepEqual(await api.act("reset"), { ok: true });
  assert.deepEqual(await api.act("resume"), { ok: false, reason: "action-unavailable" });
  assert.deepEqual(await api.act("end"), { ok: false, reason: "unsupported-action" });
  assert.deepEqual(actions, ["pause", "reset", "resume"]);
  cleanup();
  assert.equal(pageWindow[PUBLIC_CONTROL_GLOBAL], undefined);
});
