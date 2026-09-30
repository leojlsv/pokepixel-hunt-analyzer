/*
 * Offline visual reference. Imports real view, styles and renderers but does
 * not import userscript/main.js, observe WebSockets or open IndexedDB.
 * Synthetic sample values must never be presented as real Hunt analytics.
 */
import { createUi } from "../../../userscript/ui.js";
import { createClosedHud } from "../../../userscript/closed-hud-runtime.js";
import { createAudioAlerts } from "../../../userscript/audio-alerts-runtime.js";
import { createCatchGallery } from "../../../userscript/catch-gallery.js";
import { computeSessionMetrics } from "../../../domain/sessionMetrics.js";

const parameters = new URLSearchParams(window.location.search);
const mode = parameters.get("mode") === "mobile" ? "mobile" : "desktop";
const view = ["current", "history", "misc", "hud"].includes(parameters.get("view"))
  ? parameters.get("view")
  : "current";
const panelWidth = Number(parameters.get("panel")) === 415 ? 415 : 620;
const now = Date.now();
const startedAtMs = now - 3 * 60 * 60 * 1000;

const scenario = Object.freeze({
  sessionId: "synthetic-reference-2026",
  status: "running",
  startedAtMs,
  accumulatedActiveMs: 2 * 60 * 60 * 1000,
  resumedAtMs: now - 28 * 60 * 1000,
  potionsUsed: 3,
  potionsCost: 750
});

const examples = [
  ["Gengar", "94", "epic", "success", true, 176, 0.33291, "Ultra Ball"],
  ["Tyranitar", "248", "legendary", "success", false, 157, 0.08129, "Great Ball"],
  ["Pikachu", "25", "common", "failed", false, 100, 0.45718, "Poké Ball"],
  ["Lanturn", "171", "uncommon", "success", false, 150, 0.14349, "Great Ball"],
  ["Scyther", "123", "rare", "failed", false, 132, 0.12025, "Ultra Ball"],
  ["Dragonite", "149", "mythical", "success", true, 182, 0.00627, "Master Ball"],
  ["Magneton", "82", "uncommon", "success", false, 117, 0.35219, "Great Ball"],
  ["Snorlax", "143", "epic", "failed", false, null, 0.00124, "Poké Ball"],
  ["Gyarados", "130", "rare", "success", false, 152, 0.22632, "Ultra Ball"],
  ["Skarmory", "227", "rare", "success", false, 163, 0.11683, "Great Ball"],
  ["Arcanine", "59", "epic", "success", false, 154, 0.25714, "Ultra Ball"],
  ["Machamp", "68", "common", "failed", false, 93, 0.35671, "Poké Ball"]
];

const encounters = examples.map(([speciesName, speciesId, quality, captureResult, isShiny, ivTotal, captureChance, capsuleName], index) => ({
  encounterId: `synthetic-encounter-${index}`,
  sessionId: scenario.sessionId,
  speciesName,
  speciesId,
  quality,
  captureResult,
  isShiny,
  ivTotal,
  ivs: Number.isFinite(ivTotal) ? { hp: 31, atk: 30, spa: 28, def: 29, spd: 30, spe: Math.max(0, ivTotal - 148) } : null,
  qualityMultiplier: captureResult === "success" ? 1 + index / 20 : null,
  gender: index % 2 ? "female" : "male",
  nature: index % 2 ? "Jolly" : "Timid",
  capsuleName,
  captureChance,
  captureAtMs: now - (index + 1) * 10 * 60 * 1000,
  updatedAtMs: now - index * 10 * 60 * 1000,
  gold: 365 + 33 * index,
  lootSellValue: 110 + 41 * index,
  trainerExp: 105_000 + 12_000 * index,
  pokemonExp: 70_000 + 7_500 * index,
  supplyCost: 12 + 8 * index,
  autoSold: false,
  elements: ["Dark"]
}));

// Isolate this demonstration from the real userscript persistence keys and
// ensure reproducible navigation for every screenshot invocation.
try {
  localStorage.setItem("pokepixel_hunt_analyzer_ui_v2", JSON.stringify({
    shared: { view: "current", open: true, modeOverride: mode },
    desktop: { panel: null, launcher: null },
    mobile: { launcher: null }
  }));
} catch {
  // The screenshot remains usable if file:// storage is disabled.
}
document.body.dataset.mode = mode;
const completedSession = {
  ...scenario,
  status: "ended",
  endedAtMs: now,
  accumulatedActiveMs: 2 * 60 * 60 * 1000
};
const metrics = computeSessionMetrics({ session: scenario, encounters, now });
const ui = createUi({
  onSessionAction: () => {},
  onLoadHistorySessions: async () => [completedSession],
  onLoadHistorySessionEncounters: async () => encounters
});
const hud = createClosedHud({ pageWindow: window });
hud.mount();
const alerts = createAudioAlerts();
alerts.mountControls();
const gallery = createCatchGallery({ loadEncounters: async () => encounters });
gallery.mountControls();

ui.setActive(true);
ui.renderCurrent({
  metrics,
  encounters,
  sessionId: scenario.sessionId,
  encounterSnapshotVersion: 1
});
hud.render({ metrics, encounters, sessionId: scenario.sessionId });

const shadow = document.getElementById("pokepixel-hunt-analyzer-root")?.shadowRoot;
const panel = shadow?.getElementById("pha-panel");
if (panel) {
  panel.hidden = false;
  if (mode === "desktop") {
    panel.style.left = window.innerWidth > 1000 ? "300px" : "40px";
    panel.style.top = "25px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.width = `${panelWidth}px`;
    panel.style.height = `${Math.max(450, Math.min(window.innerHeight - 50, 920))}px`;
  }
}

if (view === "history") shadow?.querySelector('[data-view="history"]')?.click();
if (view === "misc") shadow?.getElementById("alerts-tab")?.click();
if (view === "hud") shadow?.getElementById("pha-hud-settings-button")?.click();

if (mode === "mobile") {
  const launcher = shadow?.getElementById("pha-toggle");
  if (launcher) launcher.hidden = true;
}

document.documentElement.dataset.referenceReady = "true";
