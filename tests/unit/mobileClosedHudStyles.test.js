import assert from "node:assert/strict";
import test from "node:test";

import { MOBILE_CLOSED_HUD_STYLES } from "../../userscript/closed-hud-mobile-styles.js";

test("Mobile Closed HUD keeps the validated 220x52 footprint and touch drag surface", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /#pha-toggle\.pha-custom-hud \{[\s\S]*width: 220px !important;[\s\S]*height: 52px !important;[\s\S]*touch-action: none;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /max-width: calc\(100vw - var\(--pha-safe-left\) - var\(--pha-safe-right\) - 16px\) !important;/
  );
});

test("Mobile Closed HUD settings expose touch-sized controls", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-settings select,[\s\S]*\.pha-hud-settings button \{[\s\S]*min-height: 42px;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-slot-configs \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/
  );
});

test("Mobile rarity HUD configuration uses larger checkbox targets", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-rarity-checks \{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-rarity-checks input \{[\s\S]*width: 18px;[\s\S]*height: 18px;/
  );
});
