import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_STORAGE_KEY,
  PALETTE_STYLES,
  normalizePalette,
  readPalette,
  selectPalette
} from "../../userscript/palette-theme.js";

test("only the four approved palettes are selectable, with Obsidiana as the safe default", () => {
  assert.equal(DEFAULT_PALETTE, "obsidian");
  assert.deepEqual(Object.keys(PALETTES), ["obsidian", "amethyst", "copper", "titanium"]);
  for (const value of [null, undefined, "original", "green", "Obsidiana", "__proto__", ""]) {
    assert.equal(normalizePalette(value), "obsidian");
  }
  assert.equal(normalizePalette("copper"), "copper");
  assert.ok(!PALETTE_STYLES.includes('data-pha-palette="green"'));
  assert.ok(!PALETTE_STYLES.includes('data-pha-palette="original"'));
  for (const [id, entry] of Object.entries(PALETTES)) {
    assert.match(PALETTE_STYLES, new RegExp(`:host\\(\\[data-pha-palette="${id}"\\]\\)`));
    assert.ok(PALETTE_STYLES.includes(`--hunt-surface-canvas:${entry.canvas}`));
  }
  assert.ok(PALETTE_STYLES.includes("--hunt-state-active-bg") === false, "state colors remain independent");
});

test("versioned persistence survives reload, coerces retired palettes and tolerates blocked storage", () => {
  const window = new Window({ url: "https://example.test/" });
  try {
    assert.equal(readPalette(window.localStorage), "obsidian");
    const host = window.document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    assert.equal(selectPalette(shadow, "amethyst", window.localStorage), "amethyst");
    assert.equal(host.dataset.phaPalette, "amethyst");
    assert.equal(window.localStorage.getItem(PALETTE_STORAGE_KEY), "amethyst");
    assert.equal(readPalette(window.localStorage), "amethyst");
    window.localStorage.setItem(PALETTE_STORAGE_KEY, "original");
    assert.equal(readPalette(window.localStorage), "obsidian");
    assert.equal(selectPalette(shadow, "green", window.localStorage), "obsidian");
    assert.equal(window.localStorage.getItem(PALETTE_STORAGE_KEY), "obsidian");

    const blockedStorage = {
      getItem() { throw new Error("Storage unavailable"); },
      setItem() { throw new Error("Storage unavailable"); }
    };
    assert.equal(readPalette(blockedStorage), "obsidian");
    assert.equal(selectPalette(shadow, "titanium", blockedStorage), "titanium");
    assert.equal(host.dataset.phaPalette, "titanium", "selection applies even without storage");
  } finally {
    window.happyDOM.abort();
  }
});
