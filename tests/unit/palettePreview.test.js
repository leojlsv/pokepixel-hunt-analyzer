import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Window } from "happy-dom";
import { applyPalettePreview, normalizePalettePreview, PALETTE_PREVIEWS } from "../../docs/visual-redesign/palettes/preview-theme.js";
import { PALETTE_STYLES } from "../../userscript/palette-theme.js";

function luminance(hex) {
  const parts = hex.match(/[0-9a-f]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255);
  return parts.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("offline palette selection uses the approved production CSS and defaults to Obsidiana", () => {
  const window = new Window();
  try {
    const host = window.document.createElement("div");
    window.document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    assert.equal(normalizePalettePreview("unknown"), "obsidian");
    assert.equal(normalizePalettePreview(null), "obsidian");
    assert.equal(applyPalettePreview(shadow, "obsidian"), "obsidian");
    assert.equal(host.dataset.phaPreviewPalette, "obsidian");
    assert.match(shadow.getElementById("pha-offline-palette-preview").textContent, /--hunt-surface-canvas:#171c23/);
    for (const [id, canvas] of [
      ["titanium", "#191d23"],
      ["amethyst", "#1d1a29"], ["copper", "#211c1b"]
    ]) {
      assert.equal(applyPalettePreview(shadow, id), id);
      assert.equal(host.dataset.phaPreviewPalette, id);
      assert.equal(shadow.querySelectorAll("#pha-offline-palette-preview").length, 1);
      assert.ok(shadow.getElementById("pha-offline-palette-preview").textContent.includes("--hunt-surface-canvas:" + canvas));
    }

    assert.equal(applyPalettePreview(shadow, "garbage"), "obsidian");
    assert.equal(host.dataset.phaPreviewPalette, "obsidian");
    assert.equal(shadow.querySelectorAll("#pha-offline-palette-preview").length, 1);
    assert.ok(PALETTE_STYLES.includes(':host([data-pha-palette="obsidian"])'));
  } finally {
    window.happyDOM.abort();
  }
});

test("preliminary text and decorative accent palettes meet normal-text contrast on primary surfaces", () => {
  assert.deepEqual(Object.keys(PALETTE_PREVIEWS), ["obsidian", "amethyst", "copper", "titanium"]);
  for (const entry of Object.values(PALETTE_PREVIEWS)) {
    assert.ok(contrast(entry.text, entry.canvas) >= 4.5, entry.id + ": text/canvas");
    assert.ok(contrast(entry.text, entry.raised) >= 4.5, entry.id + ": text/raised");
    assert.ok(contrast(entry.accent, entry.canvas) >= 4.5, entry.id + ": accent/canvas");
    assert.ok(contrast(entry.accent, entry.raised) >= 4.5, entry.id + ": accent/raised");
  }
});

test("offline screenshot comparator switches candidate, screen and viewport with Obsidiana as reference", async () => {
  const html = await readFile(new URL("../../docs/visual-redesign/palettes/compare.html", import.meta.url), "utf8");
  const js = await readFile(new URL("../../docs/visual-redesign/palettes/compare.js", import.meta.url), "utf8");
  const window = new Window({ url: "https://preview.invalid/docs/visual-redesign/palettes/compare.html?palette=copper&screen=hud-1&size=mobile-390" });
  try {
    window.document.body.innerHTML = html.split("<body>")[1].split("</body>")[0];
    window.eval(js);
    const baseline = window.document.getElementById("shot-baseline");
    const candidate = window.document.getElementById("shot-candidate");
    assert.equal(baseline.getAttribute("src"), "./screenshots/obsidian/mobile-390-hud-1.png");
    assert.equal(candidate.getAttribute("src"), "./screenshots/copper/mobile-390-hud-1.png");
    assert.equal(window.document.querySelector('[data-palette="copper"]').getAttribute("aria-pressed"), "true");
    assert.equal(window.document.getElementById("baseline-title").textContent, "Obsidiana");

    window.document.querySelector('[data-palette="titanium"]').click();
    assert.equal(candidate.getAttribute("src"), "./screenshots/titanium/mobile-390-hud-1.png");
    window.document.querySelector('[data-screen="history"]').click();
    window.document.querySelector('[data-size="desktop-620"]').click();
    assert.equal(baseline.getAttribute("src"), "./screenshots/obsidian/desktop-620-history.png");
    assert.equal(candidate.getAttribute("src"), "./screenshots/titanium/desktop-620-history.png");
    assert.match(window.document.getElementById("live-baseline").href, /palette=obsidian/);
    assert.match(window.document.getElementById("live-candidate").href, /palette=titanium/);
    window.document.querySelector('[data-palette="amethyst"]').click();
    assert.equal(candidate.getAttribute("src"), "./screenshots/amethyst/desktop-620-history.png");
    assert.equal(window.document.querySelector('[data-screen="history"]').getAttribute("aria-pressed"), "true");
    assert.equal(window.document.querySelectorAll('[data-palette="green"],[data-palette="original"]').length, 0, "Retired themes are not offered");
    assert.equal(window.document.querySelectorAll('.gallery-card').length, 2);
  } finally {
    window.happyDOM.abort();
  }
});
