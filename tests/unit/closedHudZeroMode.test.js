import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeHudColumns } from "../../userscript/closed-hud-runtime.js";

const RUNTIME = await readFile(
  new URL("../../userscript/closed-hud-runtime.js", import.meta.url),
  "utf8"
);
const MOBILE_HUD_STYLES = await readFile(
  new URL("../../userscript/closed-hud-mobile-styles.js", import.meta.url),
  "utf8"
);

test("isolated Closed HUD checkpoint only accepts PX-only or the current two-column HUD", () => {
  assert.equal(normalizeHudColumns(0), 0);
  assert.equal(normalizeHudColumns("0"), 0);
  assert.equal(normalizeHudColumns(2), 2);
  assert.equal(normalizeHudColumns("2"), 2);
  assert.equal(normalizeHudColumns(1), 2);
  assert.equal(normalizeHudColumns(null), 2);
});

test("PX-only mode persists independently without mutating the four-slot widget config", () => {
  assert.match(RUNTIME, /pokepixel_hunt_analyzer_closed_hud_columns_v1/);
  assert.match(RUNTIME, /<option value="2">2 · Current HUD<\/option>/);
  assert.match(RUNTIME, /<option value="0">0 · PX only<\/option>/);
  assert.doesNotMatch(RUNTIME, /<option value="1">/);
  assert.match(RUNTIME, /slotConfigs\.hidden = pxOnly/);
  assert.match(RUNTIME, /preset\.disabled = pxOnly/);
  assert.match(RUNTIME, /reset\.disabled = pxOnly/);
});

test("PX-only mode hides the HUD grid and keeps only the PX launcher footprint", () => {
  assert.match(
    RUNTIME,
    /#pha-toggle\.pha-custom-hud\[data-hud-columns="0"\] \{[\s\S]*width:52px !important;[\s\S]*min-width:52px !important;[\s\S]*grid-template-columns:32px !important;/
  );
  assert.match(
    RUNTIME,
    /#pha-toggle\.pha-custom-hud\[data-hud-columns="0"\] \.pha-hud-grid \{[\s\S]*display:none !important;/
  );
  assert.match(RUNTIME, /window\.dispatchEvent\(new Event\("resize"\)\)/);
});

test("Mobile PX-only mode overrides the validated 220px mobile HUD footprint", () => {
  assert.match(
    MOBILE_HUD_STYLES,
    /:host\(\[data-ui-mode="mobile"\]\) #pha-toggle\.pha-custom-hud\[data-hud-columns="0"\] \{[\s\S]*width: 52px !important;[\s\S]*min-width: 52px !important;[\s\S]*max-width: 52px !important;/
  );
});
