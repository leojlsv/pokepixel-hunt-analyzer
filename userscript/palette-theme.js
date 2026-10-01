/** Approved Analyzer palette catalog and CSS. No gameplay or analytics dependencies. */
export const DEFAULT_PALETTE = "obsidian";
export const PALETTE_STORAGE_KEY = "pokepixel_hunt_analyzer_palette_v1";
export const PALETTES = Object.freeze({
  obsidian: Object.freeze({ id: "obsidian", label: "Obsidiana", canvas: "#171c23", raised: "#222a33", text: "#ebf3fa", accent: "#8cbcff" }),
  amethyst: Object.freeze({ id: "amethyst", label: "Ametista Noturna", canvas: "#1d1a29", raised: "#2a263a", text: "#f1edff", accent: "#c6a8ff" }),
  copper: Object.freeze({ id: "copper", label: "Cobre Vulcânico", canvas: "#211c1b", raised: "#312924", text: "#f5eee8", accent: "#e9b48d" }),
  titanium: Object.freeze({ id: "titanium", label: "Titânio", canvas: "#191d23", raised: "#272d35", text: "#eff3f7", accent: "#c2d6e9" })
});

export function normalizePalette(value) {
  return Object.hasOwn(PALETTES, value) ? value : DEFAULT_PALETTE;
}

export function readPalette(storage) {
  try {
    const activeStorage = storage === undefined ? globalThis.localStorage : storage;
    return normalizePalette(activeStorage?.getItem(PALETTE_STORAGE_KEY));
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function selectPalette(shadow, value, storage) {
  const selected = normalizePalette(value);
  if (shadow?.host) shadow.host.dataset.phaPalette = selected;
  try {
    const activeStorage = storage === undefined ? globalThis.localStorage : storage;
    activeStorage?.setItem(PALETTE_STORAGE_KEY, selected);
  } catch {
    // The current session still displays the chosen palette.
  }
  return selected;
}

export const PALETTE_STYLES = String.raw`
/* Scoped to this Analyzer host; game styles and semantic state colors remain independent. */
:host([data-pha-palette="obsidian"]) {
  color:#ebf3fa;
  --hunt-surface-canvas:#171c23;
  --hunt-surface-raised:#222a33;
  --hunt-surface-header:#26313d;
  --hunt-surface-topbar:#24303b;
  --hunt-surface-launcher:#1e2831;
  --hunt-surface-control:#2b3541;
  --hunt-surface-control-active:#35485e;
  --hunt-border-default:#485a6d;
  --hunt-border-soft:#3a4b5d;
  --hunt-text-primary:#ebf3fa;
  --hunt-text-muted:#b5c6d7;
  --hunt-accent-primary:#8cbcff;
  --hunt-accent-border:#78a7dd;
  --hunt-accent-info:#78d4e8;
  --hunt-focus-ring:#8cbcff;
  --pha-palette-tabs:#1d2631;
  --pha-palette-live:#222d37;
  --pha-palette-table-head:#2a3744;
  --pha-palette-table-text:#c2d7f4;
  --pha-palette-detail:#1b242d;
  --pha-palette-soft-text:#c1d2e0;
  --pha-palette-label:#c0d8fa;
  --pha-palette-badge:#36475a;
  --pha-palette-hover:#354554;
  --pha-palette-scrollbar:#7795b0;
  --pha-palette-mark:#30465d;
  --pha-palette-divider:#476078;
  --pha-palette-rarity-highlight:#363243;
  --pha-palette-rarity-highlight-hover:#41394c;
}

:host([data-pha-palette="titanium"]) {
  color:#eff3f7;
  --hunt-surface-canvas:#191d23;
  --hunt-surface-raised:#272d35;
  --hunt-surface-header:#2c3540;
  --hunt-surface-topbar:#29313a;
  --hunt-surface-launcher:#212932;
  --hunt-surface-control:#343d47;
  --hunt-surface-control-active:#435261;
  --hunt-border-default:#647381;
  --hunt-border-soft:#475563;
  --hunt-text-primary:#eff3f7;
  --hunt-text-muted:#bac8d5;
  --hunt-accent-primary:#c2d6e9;
  --hunt-accent-border:#a5bdd4;
  --hunt-accent-info:#8acff0;
  --hunt-focus-ring:#c2d6e9;
  --pha-palette-tabs:#222932;
  --pha-palette-live:#2c3440;
  --pha-palette-table-head:#333e4a;
  --pha-palette-table-text:#d5e3ee;
  --pha-palette-detail:#222933;
  --pha-palette-soft-text:#c6d0da;
  --pha-palette-label:#c2d6e9;
  --pha-palette-badge:#42515f;
  --pha-palette-hover:#3e4954;
  --pha-palette-scrollbar:#8599aa;
  --pha-palette-mark:#3a4755;
  --pha-palette-divider:#60778d;
  --pha-palette-rarity-highlight:#39333a;
  --pha-palette-rarity-highlight-hover:#453d46;
}

:host([data-pha-palette="amethyst"]) {
  color:#f1edff;
  --hunt-surface-canvas:#1d1a29;
  --hunt-surface-raised:#2a263a;
  --hunt-surface-header:#322b47;
  --hunt-surface-topbar:#2e2840;
  --hunt-surface-launcher:#242031;
  --hunt-surface-control:#38324a;
  --hunt-surface-control-active:#514267;
  --hunt-border-default:#65577d;
  --hunt-border-soft:#4d4261;
  --hunt-text-primary:#f1edff;
  --hunt-text-muted:#c6b9dd;
  --hunt-accent-primary:#c6a8ff;
  --hunt-accent-border:#ad8ae9;
  --hunt-accent-info:#92c8ee;
  --hunt-focus-ring:#d0baff;
  --pha-palette-tabs:#261f37;
  --pha-palette-live:#302941;
  --pha-palette-table-head:#3a3150;
  --pha-palette-table-text:#e0d2ff;
  --pha-palette-detail:#251f33;
  --pha-palette-soft-text:#d5c9e7;
  --pha-palette-label:#d6bfff;
  --pha-palette-badge:#514268;
  --pha-palette-hover:#493e60;
  --pha-palette-scrollbar:#9e86bf;
  --pha-palette-mark:#433459;
  --pha-palette-divider:#796593;
  --pha-palette-rarity-highlight:#433549;
  --pha-palette-rarity-highlight-hover:#514057;
}

:host([data-pha-palette="copper"]) {
  color:#f5eee8;
  --hunt-surface-canvas:#211c1b;
  --hunt-surface-raised:#312924;
  --hunt-surface-header:#382d29;
  --hunt-surface-topbar:#332924;
  --hunt-surface-launcher:#28221f;
  --hunt-surface-control:#40332d;
  --hunt-surface-control-active:#5b4539;
  --hunt-border-default:#796253;
  --hunt-border-soft:#5b483d;
  --hunt-text-primary:#f5eee8;
  --hunt-text-muted:#d2bfb1;
  --hunt-accent-primary:#e9b48d;
  --hunt-accent-border:#d59a70;
  --hunt-accent-info:#9cd0ee;
  --hunt-focus-ring:#f2c39f;
  --pha-palette-tabs:#29211f;
  --pha-palette-live:#352a26;
  --pha-palette-table-head:#44332c;
  --pha-palette-table-text:#f2d3bc;
  --pha-palette-detail:#281f1c;
  --pha-palette-soft-text:#e0cbbb;
  --pha-palette-label:#eac7a8;
  --pha-palette-badge:#584133;
  --pha-palette-hover:#513c33;
  --pha-palette-scrollbar:#ac8972;
  --pha-palette-mark:#49382f;
  --pha-palette-divider:#81614d;
  --pha-palette-rarity-highlight:#453038;
  --pha-palette-rarity-highlight-hover:#533641;
}

/* Existing alias variables resolve to the palette semantics automatically. */
:host([data-pha-palette]) {
  --bg:var(--hunt-surface-canvas);
  --bg-elevated:var(--hunt-surface-raised);
  --bg-header:var(--hunt-surface-header);
  --border:var(--hunt-border-default);
  --border-soft:var(--hunt-border-soft);
  --text:var(--hunt-text-primary);
  --muted:var(--hunt-text-muted);
  --gold:var(--hunt-accent-primary);
  --gold-soft:var(--hunt-accent-border);
  --cyan:var(--hunt-accent-info);
}

:host([data-pha-palette]) * { scrollbar-color:var(--pha-palette-scrollbar) var(--bg); }
:host([data-pha-palette]) *::-webkit-scrollbar-thumb { background:var(--pha-palette-scrollbar); }
:host([data-pha-palette]) *::-webkit-scrollbar-thumb:hover { background:var(--gold-soft); }
:host([data-pha-palette]) .launcher { border-color:var(--border); }
:host([data-pha-palette]) .hud-mark { background:var(--pha-palette-mark); }
:host([data-pha-palette]) .tabs { background:var(--pha-palette-tabs); }
:host([data-pha-palette]) .live-card { background:var(--pha-palette-live); }
:host([data-pha-palette]) .hunt-status { background:var(--pha-palette-badge);color:var(--text); }
:host([data-pha-palette]) .section-badge { background:var(--pha-palette-badge); }
:host([data-pha-palette]) .metric-cards article > span,
:host([data-pha-palette]) .capture-strip article > span,
:host([data-pha-palette]) .filters label,
:host([data-pha-palette]) .filters .filter-field > span,
:host([data-pha-palette]) .history-filter-grid label,
:host([data-pha-palette]) .pha-hud-settings label,
:host([data-pha-palette]) .pha-hud-slot-config > span { color:var(--pha-palette-label); }
:host([data-pha-palette]) .alpha-button {
  border-color:var(--gold-soft); background:var(--hunt-surface-control-active); color:var(--gold);
}
:host([data-pha-palette]) .alpha-button:hover { background:var(--pha-palette-hover); }
:host([data-pha-palette]) .tab,
:host([data-pha-palette]) .actions button,
:host([data-pha-palette]) .collapse-button,
:host([data-pha-palette]) .icon-button { border-color:var(--border); }
:host([data-pha-palette]) .collapse-button:hover,
:host([data-pha-palette]) tbody tr:hover td { background:var(--pha-palette-hover); }
:host([data-pha-palette]) th { background:var(--pha-palette-table-head);color:var(--pha-palette-table-text); }
:host([data-pha-palette]) td { border-bottom-color:var(--border-soft); }
:host([data-pha-palette]) .encounter-row-shiny td { background:var(--pha-palette-rarity-highlight); }
:host([data-pha-palette]) .encounter-row-shiny:hover td { background:var(--pha-palette-rarity-highlight-hover); }
:host([data-pha-palette]) .history-detail-row td { background:var(--pha-palette-detail);color:var(--pha-palette-soft-text); }
:host([data-pha-palette]) .history-detail-grid b,
:host([data-pha-palette]) .history-fled-line b,
:host([data-pha-palette]) .history-notable-controls > b { color:var(--pha-palette-label); }
:host([data-pha-palette]) .history-fled-line { border-top-color:var(--border-soft); }
:host([data-pha-palette]) .history-hunt-row[aria-expanded="true"] td,
:host([data-pha-palette]) .history-attempt-row[aria-expanded="true"] td,
:host([data-pha-palette]) .history-pokemon-row[aria-expanded="true"] td { background:var(--pha-palette-hover); }
:host([data-pha-palette]) .history-notable-list { background:var(--bg);border-color:var(--border-soft); }
:host([data-pha-palette]) .history-notable-list th,
:host([data-pha-palette]) .history-pokemon-rarity-table th { background:var(--pha-palette-table-head);color:var(--pha-palette-table-text); }
:host([data-pha-palette]) .history-more-button,
:host([data-pha-palette]) .history-notable-button { background:var(--hunt-surface-control);border-color:var(--border);color:var(--pha-palette-label); }
:host([data-pha-palette]) .history-notable-button:hover:not(:disabled),
:host([data-pha-palette]) .history-notable-button.active { background:var(--hunt-surface-control-active);border-color:var(--gold-soft); }
:host([data-pha-palette]) .pha-hud-slot { border-left-color:var(--pha-palette-divider); }
:host([data-pha-palette]) .pha-hud-slot-label { color:var(--pha-palette-label); }
:host([data-pha-palette]) .pha-hud-slot-value:not(.positive):not(.negative),
:host([data-pha-palette]) .pha-hud-inventory-primary { color:var(--text); }
:host([data-pha-palette]) .pha-hud-inventory-secondary,
:host([data-pha-palette]) .pha-hud-rarity-failed,
:host([data-pha-palette]) .pha-hud-shiny-seen { color:var(--pha-palette-soft-text); }
:host([data-pha-palette]) .pha-hud-settings { background:var(--bg-elevated); }
:host([data-pha-palette]) .pha-hud-slot-config { background:var(--bg);border-color:var(--border-soft); }
:host([data-pha-palette]) .pha-hud-rarity-config { border-top-color:var(--border-soft); }
:host([data-pha-palette]) .pha-hud-rarity-checks label { background:var(--bg);border-color:var(--border-soft); }
:host([data-pha-palette]) .pha-hud-inventory-status { color:var(--muted); }
:host([data-pha-palette]) .rarity-check-menu { background:var(--bg); }
:host([data-pha-palette]) .filters .rarity-check-option:hover { background:var(--pha-palette-hover); }
:host([data-pha-palette]) .filters .rarity-check-option input { accent-color:var(--gold); }
:host([data-pha-palette]) .filters .rarity-check-all { border-bottom-color:var(--border-soft); }

/* Intentional exclusions: .rarity-*, .shiny-*, .positive/.negative,
   .value-positive/.value-negative, .history-result-*, .iv-*, and
   #new-hunt/#pause-resume/#end-hunt preserve their data/state identities. */
`;
