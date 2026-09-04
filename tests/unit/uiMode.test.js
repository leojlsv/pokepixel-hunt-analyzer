import assert from "node:assert/strict";
import test from "node:test";

import {
  detectAutoUiMode,
  normalizeUiModeOverride,
  resolveUiMode
} from "../../userscript/ui-mode.js";

function matchMediaFor({ coarse = false, noHover = false } = {}) {
  return (query) => ({
    matches: query === "(pointer: coarse)" ? coarse :
      query === "(hover: none)" ? noHover : false
  });
}

test("normalizes unknown UI mode overrides to auto", () => {
  assert.equal(normalizeUiModeOverride("mobile"), "mobile");
  assert.equal(normalizeUiModeOverride("DESKTOP"), "desktop");
  assert.equal(normalizeUiModeOverride("invalid"), "auto");
});

test("detects phone portrait and landscape as mobile", () => {
  const matchMedia = matchMediaFor({ coarse: true, noHover: true });

  assert.equal(detectAutoUiMode({ matchMedia, innerWidth: 390, innerHeight: 844 }), "mobile");
  assert.equal(detectAutoUiMode({ matchMedia, innerWidth: 844, innerHeight: 390 }), "mobile");
});

test("keeps narrow desktop windows in desktop mode", () => {
  const matchMedia = matchMediaFor({ coarse: false, noHover: false });
  assert.equal(detectAutoUiMode({ matchMedia, innerWidth: 600, innerHeight: 700 }), "desktop");
});

test("keeps tablets above the initial minimum-dimension threshold in desktop mode", () => {
  const matchMedia = matchMediaFor({ coarse: true, noHover: true });
  assert.equal(detectAutoUiMode({ matchMedia, innerWidth: 800, innerHeight: 1280 }), "desktop");
});

test("manual override wins over automatic detection", () => {
  const desktopMedia = matchMediaFor({ coarse: false, noHover: false });
  const mobileMedia = matchMediaFor({ coarse: true, noHover: true });

  assert.equal(resolveUiMode({
    override: "mobile",
    matchMedia: desktopMedia,
    innerWidth: 1920,
    innerHeight: 1080
  }), "mobile");

  assert.equal(resolveUiMode({
    override: "desktop",
    matchMedia: mobileMedia,
    innerWidth: 390,
    innerHeight: 844
  }), "desktop");
});
