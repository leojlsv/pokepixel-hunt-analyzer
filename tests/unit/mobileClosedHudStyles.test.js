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
    /\.pha-hud-settings select,[\s\S]*\.pha-hud-settings button \{[\s\S]*min-height: 44px;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-slot-configs \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-topbar #pha-close \{[\s\S]*width: 44px;[\s\S]*height: 44px;/
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

test("Mobile Interface controls match the label-over-control filter layout", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-interface-setting \{[\s\S]*padding: 0;[\s\S]*flex-direction: column;[\s\S]*align-items: stretch;[\s\S]*border: 0;[\s\S]*background: transparent;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-interface-setting \.pha-ui-mode-select,[\s\S]*\.pha-interface-setting \.alpha-button \{[\s\S]*width: 100%;[\s\S]*max-width: none;[\s\S]*height: 44px;/
  );
});

test("Mobile HUD column selector stays inside its settings panel", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-zero-control \{[\s\S]*width: 100%;[\s\S]*min-width: 0;[\s\S]*display: grid;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-zero-control select \{[\s\S]*width: 100%;[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/
  );
});

test("Mobile keeps native selects at their available layout width", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.panel select \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;[\s\S]*box-sizing: border-box;/
  );
  assert.doesNotMatch(MOBILE_CLOSED_HUD_STYLES, /margin-right: 24px/);
  assert.doesNotMatch(MOBILE_CLOSED_HUD_STYLES, /pha-hud-select-proxy/);
});

test("Mobile bounds only the HUD Columns menu in this checkpoint", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-columns-menu \{[\s\S]*left: 0;[\s\S]*width: 100%;[\s\S]*overflow-y: auto;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-columns-proxy > select \{[\s\S]*clip-path: inset\(50%\);/
  );
});

test("Mobile bounds HUD widget menus including Shiny Tracker", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-widget-menu \{[\s\S]*left: 0;[\s\S]*width: 100%;[\s\S]*max-height: min\(300px, 48vh\);/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-widget-proxy > select \{[\s\S]*clip-path: inset\(50%\);/
  );
});

test("Mobile bounds the HUD Preset menu", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-preset-menu \{[\s\S]*left: 0;[\s\S]*width: 100%;[\s\S]*max-height: 224px;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-preset-proxy > select \{[\s\S]*clip-path: inset\(50%\);/
  );
});

test("Mobile bounds rarity widget Width menus", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-width-menu \{[\s\S]*left: 0;[\s\S]*width: 100%;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-width-proxy > select \{[\s\S]*clip-path: inset\(50%\);/
  );
});

test("Mobile bounds dynamic Capsule and Potion item menus", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-item-proxy \{[\s\S]*grid-column: 2;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-hud-item-menu \{[\s\S]*width: 100%;[\s\S]*max-height: min\(300px, 48vh\);/
  );
});

test("Mobile bounds Current Captured and Failed Shiny menus", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-current-select-menu \{[\s\S]*left: 0;[\s\S]*width: 100%;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-current-select-proxy > select \{[\s\S]*clip-path: inset\(50%\);/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-current-select-option \{[\s\S]*background: var\(--bg-elevated\);[\s\S]*color: var\(--text\);/
  );
});

test("Mobile bounds all History filter menus", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-history-select-menu \{[\s\S]*width: 100%;[\s\S]*max-height: min\(240px, 42dvh\);[\s\S]*overflow-y: auto;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-history-select-option \{[\s\S]*background: var\(--bg-elevated\);[\s\S]*color: var\(--text\);/
  );
});

test("Mobile bounds the Catch Gallery rarity menu", () => {
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-gallery-select-menu \{[\s\S]*width: 100%;[\s\S]*max-height: 184px;[\s\S]*overflow-y: auto;/
  );
  assert.match(
    MOBILE_CLOSED_HUD_STYLES,
    /\.pha-gallery-select-option \{[\s\S]*background: var\(--bg-elevated\);[\s\S]*color: var\(--text\);/
  );
});
