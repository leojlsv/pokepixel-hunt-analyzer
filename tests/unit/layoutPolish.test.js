import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RUNTIME = await readFile(
  new URL("../../userscript/closed-hud-runtime.js", import.meta.url),
  "utf8"
);
const AUDIO_ALERTS = await readFile(
  new URL("../../userscript/audio-alerts.js", import.meta.url),
  "utf8"
);
const AUDIO_ALERTS_RUNTIME = await readFile(
  new URL("../../userscript/audio-alerts-runtime.js", import.meta.url),
  "utf8"
);

test("Sound Alerts visually separates Captured from Fled", () => {
  assert.match(AUDIO_ALERTS, /class="alert-fled-heading">Fled<\/b>/);
  assert.match(AUDIO_ALERTS, /alert-choice-pair alert-choice-pair-\$\{result\}/);
  assert.match(
    AUDIO_ALERTS,
    /\.alert-fled-heading,[\s\S]*\.alert-choice-pair-fled \{[\s\S]*padding-left: 10px;[\s\S]*border-left: 1px solid var\(--border-soft\);/
  );
});

test("Sound Alerts exposes one persistent global volume control", () => {
  assert.match(AUDIO_ALERTS, /const VOLUME_STORAGE_KEY = "pokepixel_hunt_analyzer_audio_volume_v1"/);
  assert.match(AUDIO_ALERTS, /id="alerts-volume" type="range" min="0" max="100" step="5"/);
  assert.match(AUDIO_ALERTS, /masterGain = context\.createGain\(\)/);
  assert.match(AUDIO_ALERTS, /source\.connect\(destination\)/);
});

test("Sound Alerts exposes an accessible section collapse control", () => {
  assert.match(AUDIO_ALERTS, /class="section sound-alerts-section"/);
  assert.match(AUDIO_ALERTS, /class="collapse-button alert-collapse"[^>]*aria-expanded="true"[^>]*aria-controls="sound-alerts-content"/);
  assert.match(AUDIO_ALERTS, /const collapsed = section\?\.classList\.toggle\("collapsed"\) === true/);
  assert.match(AUDIO_ALERTS, /collapseButton\.setAttribute\("aria-expanded", String\(!collapsed\)\)/);
});

test("Sound Alerts places mute before the collapse control", () => {
  assert.match(AUDIO_ALERTS_RUNTIME, /const collapseButton = meta\.querySelector\("\.alert-collapse"\)/);
  assert.match(AUDIO_ALERTS_RUNTIME, /if \(collapseButton\) collapseButton\.before\(button\)/);
});

test("HUD configuration moves out of the topbar and sits beside Misc in every UI mode", () => {
  assert.match(RUNTIME, /const MISC_TAB_ID = "alerts-tab"/);
  assert.match(RUNTIME, /settingsButton\.classList\.remove\("alpha-button"\)/);
  assert.match(RUNTIME, /settingsButton\.classList\.add\("tab"\)/);
  assert.match(RUNTIME, /miscTab\.parentElement !== tabs\) tabs\.appendChild\(miscTab\)/);
  assert.match(RUNTIME, /miscTab\.after\(settingsButton\)/);
  assert.match(RUNTIME, /huntTime\.before\(settingsButton\)/);
});

test("HUD opens as an exclusive navigation view instead of inline collapse", () => {
  assert.match(RUNTIME, /const HUD_SETTINGS_ID = "pha-hud-settings"/);
  assert.match(RUNTIME, /function showHudView\(\)/);
  assert.match(RUNTIME, /currentView\.hidden = true/);
  assert.match(RUNTIME, /historyView\.hidden = true/);
  assert.match(RUNTIME, /miscView\.hidden = true/);
  assert.match(RUNTIME, /settings\.hidden = false/);
  assert.match(RUNTIME, /settings\.classList\.add\("pha-hud-exclusive-view"\)/);
  assert.match(RUNTIME, /settingsButton\.classList\.add\("active"\)/);
  assert.match(RUNTIME, /event\.stopImmediatePropagation\(\)/);
  assert.match(RUNTIME, /settingsButton\.addEventListener\("click",[\s\S]*true\);/);
  assert.match(RUNTIME, /function hideHudView\(\)/);
  assert.match(RUNTIME, /tab\.addEventListener\("click", hideHudView\)/);
  assert.match(RUNTIME, /miscTab\.addEventListener\("click", hideHudView\)/);
});

test("header metadata shows only the compact v-prefixed version label", () => {
  assert.match(RUNTIME, /text\.startsWith\("Userscript "\)/);
  assert.match(RUNTIME, /version\.textContent = `v\$\{text\.slice\("Userscript "\.length\)\}`/);
});

test("shared topbar pins minimize to the physical right edge", () => {
  assert.match(
    RUNTIME,
    /\.pha-hud-topbar \{[\s\S]*position:relative;[\s\S]*grid-template-columns:minmax\(0,1fr\);[\s\S]*padding-right:54px;/
  );
  assert.match(
    RUNTIME,
    /\.pha-hud-topbar #pha-close \{[\s\S]*position:absolute;[\s\S]*top:50%;[\s\S]*right:8px;[\s\S]*transform:translateY\(-50%\);[\s\S]*margin:0;/
  );
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="mobile"\]\) \.pha-hud-topbar \{[\s\S]*padding:5px 52px 5px 8px;/
  );
  assert.match(RUNTIME, /function placeOperationalStatus\(\)/);
  assert.match(RUNTIME, /huntTime\.after\(state\)/);
});

test("primary views expose tab semantics and predictable keyboard navigation", () => {
  assert.match(RUNTIME, /const NAV_ITEMS = Object\.freeze/);
  assert.match(RUNTIME, /tabs\.setAttribute\("role", "tablist"\)/);
  assert.match(RUNTIME, /tabs\.setAttribute\("aria-label", "Analyzer views"\)/);
  assert.match(RUNTIME, /item\.button\.setAttribute\("role", "tab"\)/);
  assert.match(RUNTIME, /item\.button\.setAttribute\("aria-controls", item\.panelId\)/);
  assert.match(RUNTIME, /item\.button\.setAttribute\("aria-selected", String\(selected\)\)/);
  assert.match(RUNTIME, /item\.button\.tabIndex = selected \? 0 : -1/);
  assert.match(RUNTIME, /item\.panel\.setAttribute\("role", "tabpanel"\)/);
  assert.match(RUNTIME, /item\.panel\.setAttribute\("aria-labelledby", item\.button\.id\)/);
  assert.match(RUNTIME, /event\.key === "ArrowRight"/);
  assert.match(RUNTIME, /event\.key === "ArrowLeft"/);
  assert.match(RUNTIME, /event\.key === "Home"/);
  assert.match(RUNTIME, /event\.key === "End"/);
  assert.match(RUNTIME, /items\[nextIndex\]\.button\.focus\(\)/);
  assert.match(RUNTIME, /items\[nextIndex\]\.button\.click\(\)/);
});

test("Mobile merges the existing operational nodes into the Hunt header and restores Desktop", () => {
  assert.match(RUNTIME, /shadow\.host\?\.dataset\.uiMode === "mobile"/);
  assert.match(RUNTIME, /statusLabel\.after\(state, huntTime, huntStatus, collapseButton\)/);
  assert.match(RUNTIME, /statusLabel\.nextElementSibling !== state/);
  assert.match(RUNTIME, /state\.nextElementSibling !== huntTime/);
  assert.match(RUNTIME, /huntTime\.nextElementSibling !== huntStatus/);
  assert.match(RUNTIME, /actions\.appendChild\(collapseButton\)/);
  assert.match(RUNTIME, /tabs\.appendChild\(huntTime\)/);
});

test("Desktop compact width removes the reserved gutter and only migrates the old 430px minimum", () => {
  assert.match(RUNTIME, /const DESKTOP_COMPACT_WIDTH_PX = 415/);
  assert.match(RUNTIME, /const LEGACY_DESKTOP_MIN_WIDTH_PX = 430/);
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="desktop"\]\) \.panel \{[\s\S]*min-width:\$\{DESKTOP_COMPACT_WIDTH_PX\}px !important;[\s\S]*scrollbar-gutter:auto;/
  );
  assert.match(RUNTIME, /function compactLegacyDesktopWidth\(\)/);
  assert.match(RUNTIME, /Number\.parseFloat\(panel\.style\.width\)/);
  assert.match(RUNTIME, /restoredWidth >= LEGACY_DESKTOP_MIN_WIDTH_PX/);
  assert.match(RUNTIME, /restoredWidth <= LEGACY_DESKTOP_MIN_WIDTH_PX \+ 1/);
  assert.match(RUNTIME, /panel\.style\.width = `\$\{DESKTOP_COMPACT_WIDTH_PX\}px`/);
  assert.match(RUNTIME, /normalizeHeaderVersion\(\);\s*compactLegacyDesktopWidth\(\);/);
});

test("UI mode and opacity are staged out of the header and mounted inside Misc", () => {
  assert.match(RUNTIME, /const INTERFACE_SECTION_ID = "pha-interface-settings"/);
  assert.match(RUNTIME, /const INTERFACE_STAGING_ID = "pha-interface-staging"/);
  assert.match(RUNTIME, /function stageInterfaceControls\(\)/);
  assert.match(RUNTIME, /function ensureMiscInterfaceSettings\(\)/);
  assert.match(RUNTIME, /<h3>Interface<\/h3>/);
  assert.match(RUNTIME, /<span>UI Mode<\/span>/);
  assert.match(RUNTIME, /<span>Opacity<\/span>/);
  assert.match(RUNTIME, /modeSlot\.appendChild\(modeControl\)/);
  assert.match(RUNTIME, /alphaSlot\.appendChild\(alphaButton\)/);
});

test("bounded select proxies expose native selects on Desktop and custom summaries on Mobile", () => {
  assert.match(RUNTIME, /function syncSelectProxyMode\(proxy, select, shadow\)/);
  assert.match(RUNTIME, /if \(mode === "mobile"\) proxy\.prepend\(select\)/);
  assert.match(RUNTIME, /else proxy\.before\(select\)/);
  assert.match(RUNTIME, /syncSelectProxyMode\(proxy, select, shadow\)/);
});

test("UI mode removes its proxy and exposes the native select directly on Desktop", () => {
  assert.match(RUNTIME, /function installUiModeProxy\(\)/);
  assert.match(RUNTIME, /function syncUiModeProxy\(\)/);
  assert.match(RUNTIME, /const modeControl = SELECT_PROXY_BY_ELEMENT\.get\(modeSelect\) \|\| modeSelect/);
  assert.match(RUNTIME, /modeSlot\.appendChild\(modeControl\)/);
  assert.match(RUNTIME, /createSelectProxy\(\{[\s\S]*classPrefix: "pha-ui-mode"/);
  assert.match(RUNTIME, /if \(!isMobile\) \{[\s\S]*proxy\.before\(select\);[\s\S]*releaseSelectProxy\(select\);[\s\S]*proxy\.remove\(\);/);
  assert.match(RUNTIME, /if \(shadow\.host\?\.dataset\.uiMode !== "mobile"\) return/);
});

test("Mobile header and nav use compact shared hierarchy without a second layout", () => {
  assert.match(RUNTIME, /:host\(\[data-ui-mode="mobile"\]\) \.pha-hud-topbar \{[\s\S]*min-height:46px;[\s\S]*padding:5px 52px 5px 8px;/);
  assert.match(RUNTIME, /:host\(\[data-ui-mode="mobile"\]\) \.tabs \{[\s\S]*min-height:44px;[\s\S]*gap:4px;/);
  assert.match(RUNTIME, /:host\(\[data-ui-mode="mobile"\]\) \.tabs #pha-tab-state \{[\s\S]*font-size:8px;/);
  assert.doesNotMatch(RUNTIME, /grid-template-rows: minmax\(40px, auto\) 30px/);
});

test("Mobile capture summary stays in one four-column row", () => {
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="mobile"\]\) \.capture-strip \{\s*\n\s*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/
  );
  assert.match(
    RUNTIME,
    /:host\(\[data-ui-mode="mobile"\]\) \.capture-strip article \{[\s\S]*min-width:0;[\s\S]*min-height:56px;/
  );
});
