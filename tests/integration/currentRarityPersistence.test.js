import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { createCurrentView } from "../../userscript/current-view.js";
import { createUiMarkup } from "../../userscript/ui-markup.js";
import { RARITIES } from "../../userscript/ui-utils.js";
import { CURRENT_RARITY_PREFERENCES_KEY } from "../../userscript/current-rarity-preferences.js";

function mountCurrentView(window) {
  const root = window.document.createElement("div");
  const shadow = root.attachShadow({ mode: "open" });
  shadow.innerHTML = createUiMarkup();
  window.document.documentElement.appendChild(root);
  return { root, shadow, current: createCurrentView(shadow) };
}

function selectedRarities(shadow, list) {
  return [...shadow.querySelectorAll(`#${list}-rarity [data-rarity-value]`)]
    .filter((input) => input.checked)
    .map((input) => input.dataset.rarityValue);
}

function changeRarity(window, shadow, list, key, checked) {
  const selector = key === "*" ? "[data-rarity-all]" : `[data-rarity-value="${key}"]`;
  const checkbox = shadow.querySelector(`#${list}-rarity ${selector}`);
  checkbox.checked = checked;
  checkbox.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function sampleMetrics() {
  return {
    status: "running", activeMs: 60_000,
    rarities: Object.fromEntries(RARITIES.map(([key]) => [key, {
      seen: 0, captured: 0, failed: 0,
      shinySeen: 0, shinyCaptured: 0, shinyFailed: 0
    }]))
  };
}

function sampleEncounter(id, quality, captureResult) {
  return {
    encounterId: id, quality, captureResult, captureAtMs: 1_000,
    speciesName: id, ivTotal: 10, isShiny: false, qualityMultiplier: 1
  };
}

test("Captured rarity selection survives DOM recreation and new Hunts; Failed stays independent", () => {
  const window = new Window({ url: "https://play.pokepixel.example/" });
  const previous = new Map();
  for (const name of ["document", "localStorage", "HTMLInputElement", "requestAnimationFrame"]) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true, writable: true,
      value: name === "requestAnimationFrame"
        ? window.requestAnimationFrame.bind(window)
        : window[name]
    });
  }
  try {
    const first = mountCurrentView(window);
    assert.equal(first.shadow.getElementById("captured-rarity-label").textContent, "All (*)");
    assert.equal(first.shadow.getElementById("failed-rarity-label").textContent, "All (*)");

    for (const key of ["weak", "common", "uncommon", "rare"]) {
      changeRarity(window, first.shadow, "captured", key, false);
    }
    assert.deepEqual(selectedRarities(first.shadow, "captured"), ["epic", "legendary", "mythical"]);
    assert.equal(first.shadow.getElementById("captured-rarity-label").textContent, "3 selected");
    assert.equal(first.shadow.querySelector("#captured-rarity [data-rarity-all]").checked, false);

    changeRarity(window, first.shadow, "failed", "*", false);
    assert.deepEqual(selectedRarities(first.shadow, "failed"), []);
    assert.equal(first.shadow.getElementById("failed-rarity-label").textContent, "None");
    assert.deepEqual(JSON.parse(window.localStorage.getItem(CURRENT_RARITY_PREFERENCES_KEY)), {
      captured: ["epic", "legendary", "mythical"], failed: []
    });

    const encounters = [
      sampleEncounter("captured-weak", "weak", "success"),
      sampleEncounter("captured-epic", "epic", "success"),
      sampleEncounter("captured-legendary", "legendary", "success"),
      sampleEncounter("captured-mythical", "mythical", "success"),
      sampleEncounter("failed-epic", "epic", "failed")
    ];
    first.current.render({ metrics: sampleMetrics(), encounters, sessionId: "hunt-1", encounterSnapshotVersion: 1 });
    assert.equal(first.shadow.getElementById("captured-count").textContent, "3 Pokémons");
    assert.equal(first.shadow.getElementById("failed-count").textContent, "0 Pokémons");
    first.current.render({ metrics: sampleMetrics(), encounters, sessionId: "hunt-2", encounterSnapshotVersion: 2 });
    assert.equal(first.shadow.getElementById("captured-count").textContent, "3 Pokémons");
    assert.equal(first.shadow.getElementById("failed-count").textContent, "0 Pokémons");

    first.root.remove();
    const second = mountCurrentView(window);
    assert.deepEqual(selectedRarities(second.shadow, "captured"), ["epic", "legendary", "mythical"]);
    assert.deepEqual(selectedRarities(second.shadow, "failed"), []);
    assert.equal(second.shadow.getElementById("captured-rarity-label").textContent, "3 selected");
    assert.equal(second.shadow.getElementById("failed-rarity-label").textContent, "None");
    second.current.render({ metrics: sampleMetrics(), encounters, sessionId: "hunt-2", encounterSnapshotVersion: 3 });
    assert.equal(second.shadow.getElementById("captured-count").textContent, "3 Pokémons");
    assert.equal(second.shadow.getElementById("failed-count").textContent, "0 Pokémons");

    changeRarity(window, second.shadow, "captured", "*", true);
    assert.equal(second.shadow.getElementById("captured-rarity-label").textContent, "All (*)");
    assert.deepEqual(selectedRarities(second.shadow, "captured"), RARITIES.map(([key]) => key));
    const third = mountCurrentView(window);
    assert.equal(third.shadow.getElementById("captured-rarity-label").textContent, "All (*)");
    assert.deepEqual(selectedRarities(third.shadow, "failed"), []);
    third.root.remove();
    second.root.remove();
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    window.happyDOM.abort();
  }
});
