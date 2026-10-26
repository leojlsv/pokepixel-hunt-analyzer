import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createCurrentView } from "../../userscript/current-view.js";
import { createUiMarkup } from "../../userscript/ui-markup.js";
import { computeSessionMetrics } from "../../domain/sessionMetrics.js";

function session() {
  return { sessionId: "hunt-long", status: "running", startedAtMs: 0,
    activeStartedAtMs: 0, accumulatedActiveMs: 0, potionsUsed: 0, potionsCost: 0 };
}

function row(index, extra = {}) {
  return {
    encounterId: `e-${index}`, speciesId: "eevee", speciesName: "Eevee",
    captureResult: "failed", captureAtMs: 1_000 + index, startedAtMs: index,
    quality: "common", isShiny: false, ivTotal: index % 187,
    capsuleName: "Poké Ball", captureChance: 0.35, updatedAtMs: index,
    ...extra
  };
}

function renderState(encounters, encounterSnapshotVersion, lootDataRevision = encounterSnapshotVersion, delta = null) {
  return {
    sessionId: "hunt-long", metrics: computeSessionMetrics({ session: session(), encounters, now: 10_000 }),
    encounters, encounterSnapshotVersion, lootDataRevision, encounterDelta: delta,
    currentSessionSpecies: encounters.at(-1) || null
  };
}

test("Current terminal delta appends and restores the fallback after gaps and corrections", async () => {
  const win = new Window({ url: "https://pokepixel.nietore.com/play/" });
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { value: win.document, writable: true, configurable: true });
  const host = win.document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = createUiMarkup();
  win.document.documentElement.append(host);

  try {
    const view = createCurrentView(shadow);
    const encounters = Array.from({ length: 5_000 }, (_, i) => row(i));
    view.render(renderState(encounters, 1));
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(shadow.getElementById("failed-count").textContent.includes("5000"), true);

    const newCapture = row(5_000, { isShiny: true });
    const nextEncounters = [...encounters, newCapture];
    let fullIterations = 0;
    const observedRows = new Proxy(nextEncounters, {
      get(target, property, receiver) {
        if (property === Symbol.iterator) return function* () { fullIterations += 1; yield* target; };
        return Reflect.get(target, property, receiver);
      }
    });
    view.render({
      ...renderState(nextEncounters, 2), encounters: observedRows,
      encounterDelta: {
        fromRevision: 1, toRevision: 2,
        fromListVersion: 1, toListVersion: 2,
        changes: [{ previous: null, next: newCapture }]
      }
    });
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(fullIterations, 0, "incremental render must not revisit the entire Hunt");
    assert.equal(shadow.getElementById("failed-shiny-count").textContent.includes("1"), true);
    assert.equal(shadow.getElementById("failed-count").textContent.includes("5001"), true);

    const corrected = { ...newCapture, isShiny: false, updatedAtMs: 99_999 };
    view.render({
      ...renderState([...encounters, corrected], 3),
      encounterDelta: {
        fromRevision: 2, toRevision: 3,
        fromListVersion: 2, toListVersion: 3,
        changes: [{ previous: newCapture, next: corrected }]
      }
    });
    assert.equal(shadow.getElementById("failed-shiny-count").hidden, true,
      "correction must resynchronize filtered counters");

    view.render({
      ...renderState([...encounters, corrected, row(5_001)], 5),
      encounterDelta: {
        fromRevision: 4, toRevision: 5,
        fromListVersion: 4, toListVersion: 5,
        changes: [{ previous: null, next: row(5_001) }]
      }
    });
    assert.equal(shadow.getElementById("failed-count").textContent.includes("5002"), true,
      "revision gap falls back to the full authoritative session");
  } finally {
    // The 100-row initial/repair batches render on the next animation frame.
    await new Promise(resolve => setTimeout(resolve, 60));
    host.remove();
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else delete globalThis.document;
    win.happyDOM.abort();
  }
});

test("same-sort corrected Current row refreshes in place without rebuilding unchanged DOM rows", async () => {
  const win = new Window({ url: "https://pokepixel.nietore.com/play/" });
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    value: win.document, writable: true, configurable: true
  });
  const host = win.document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = createUiMarkup();
  win.document.documentElement.append(host);
  try {
    const view = createCurrentView(shadow);
    const initial = [row(1), row(2), row(3)];
    view.render(renderState(initial, 1));
    await new Promise(resolve => setTimeout(resolve, 30));
    const unchanged = shadow.querySelector('[data-encounter-id="e-3"]');
    const previous = shadow.querySelector('[data-encounter-id="e-2"]');
    assert.ok(unchanged && previous);

    const corrected = { ...initial[1], updatedAtMs: 999,
      capsuleName: "Ultra Ball", captureChance: 0.975 };
    view.render(renderState([initial[0], corrected, initial[2]], 2));
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.strictEqual(shadow.querySelector('[data-encounter-id="e-3"]'), unchanged,
      "unchanged rows retain DOM identity instead of full-table rebuild");
    assert.notStrictEqual(shadow.querySelector('[data-encounter-id="e-2"]'), previous,
      "corrected row receives a fresh representation");
    assert.match(shadow.querySelector('[data-encounter-id="e-2"]').textContent,
      /Ultra Ball/);
    assert.equal(shadow.getElementById("failed-count").textContent, "3 Pokémons");
  } finally {
    await new Promise(resolve => setTimeout(resolve, 30));
    host.remove();
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else delete globalThis.document;
    win.happyDOM.abort();
  }
});

test("captured same-sort correction preserves expanded details and unrelated DOM rows", async () => {
  const win = new Window({ url: "https://pokepixel.nietore.com/play/" });
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    value: win.document, writable: true, configurable: true
  });
  const host = win.document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = createUiMarkup();
  win.document.documentElement.append(host);
  try {
    const view = createCurrentView(shadow);
    const baseline = [row(1, { captureResult: "success" }),
      row(2, { captureResult: "success" }),
      row(3, { captureResult: "success" })];
    view.render(renderState(baseline, 1));
    await new Promise(resolve => setTimeout(resolve, 30));
    const stable = shadow.querySelector('[data-encounter-id="e-3"]');
    const target = shadow.querySelector('[data-encounter-id="e-2"]');
    assert.ok(stable && target);
    target.click();
    assert.equal(target.getAttribute("aria-expanded"), "true");
    assert.ok(shadow.querySelector('[data-detail-for="e-2"]'));

    const changed = { ...baseline[1], updatedAtMs: 20000,
      capsuleName: "Great Ball", captureChance: 0.85 };
    view.render(renderState([baseline[0], changed, baseline[2]], 2));
    await new Promise(resolve => setTimeout(resolve, 30));
    const refreshed = shadow.querySelector('[data-encounter-id="e-2"]');
    assert.notStrictEqual(refreshed, target);
    assert.equal(refreshed.getAttribute("aria-expanded"), "true");
    assert.strictEqual(shadow.querySelector('[data-encounter-id="e-3"]'), stable);
    assert.match(shadow.querySelector('[data-detail-for="e-2"]').textContent,
      /Great Ball/);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 30));
    host.remove();
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else delete globalThis.document;
    win.happyDOM.abort();
  }
});
