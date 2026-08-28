# Closed HUD

This document defines the compact customizable HUD introduced in v1.12.0.

The Closed HUD is a presentation layer over the current Hunt state. It does not change protocol handling, Hunt lifecycle rules or the analytics IndexedDB schema.

## 1. Layout

The minimized launcher uses a fixed 2x2 grid with four layout units.

- Standard widgets consume one unit.
- `Rarity Tracker` may consume one or two units.
- A two-unit widget owns its full row.
- The `HUD` control in the Analyzer header opens the configuration panel.
- Changes apply immediately.

Presets are available for Default, Leveling, Economy and Capture. Any manual edit moves the layout to Custom.

Closed HUD configuration is persisted in localStorage under:

```text
pokepixel_hunt_analyzer_closed_hud_v1
```

The launcher remains hidden while the UI is mounted and the current Hunt state is hydrated. It is revealed only after the first real state render, avoiding a legacy/zero-value flash during reload.

## 2. Widget catalog

### Hunt

| Widget | Meaning |
|---|---|
| Seen | Attempted encounters seen in the Hunt; compacted when necessary |
| Seen/h | Seen rate using active Hunt time |
| Hunt Time | Authoritative active Hunt duration |

### Capture

| Widget | Meaning |
|---|---|
| Captured | Successful captures; exact integer |
| Failed | Failed captures; exact integer |
| Capture Rate | `Captured / Seen` |
| Rarity Tracker | Selected rarity tiers; Captured only or `Failed / Captured` |
| Shiny Tracker | `★ Seen / Captured` for Shiny encounters |
| Rare+ Attempts | Rare+ Captured + Rare+ Failed |
| Rare+ Captured | Successful Rare+ captures |
| Rare+ Failed | Failed Rare+ captures |

`Rare+` is fixed as:

```text
Rare + Epic + Legendary + Mythical
```

### Quality

| Widget | Meaning |
|---|---|
| Highest IV | Highest non-null `ivTotal` observed in the current Hunt |

### Leveling

| Widget | Meaning |
|---|---|
| Trainer XP/h | Trainer experience per active Hunt hour |
| Pokémon XP/h | Pokémon experience per active Hunt hour |

### Economy

| Widget | Meaning |
|---|---|
| Dollar | Gross Hunt revenue |
| Dollar/h | Gross revenue per active Hunt hour |
| Profit | `Dollar - Expenses` |
| Profit/h | Profit per active Hunt hour |
| Expenses | Capsule costs + potion costs |

Dollar follows the Analyzer's existing revenue contract:

```text
kill Gold + loot sell value + realized Pokémon auto-sell
```

### Supplies

| Widget | Meaning |
|---|---|
| Total Balls Used | All terminal capture attempts across all Balls |
| Ball Tracker | Selected Ball: current inventory + `↓ used` |
| Ball Success | Successful attempts with the selected Ball |
| Ball Failed | Failed attempts with the selected Ball |
| Ball Capture Rate | `Success / Used` for the selected Ball |
| Ball Cost | Sum of `supplyCost` for attempts with the selected Ball |
| Potion Tracker | Selected Potion: current inventory + `↓ used` |

Ball metrics are aggregated from current-Hunt encounters by `capsuleItemId`. A terminal `success` or `failed` encounter counts as one Ball use.

## 3. Formatting rules

The Closed HUD is data-first and prioritizes correctness over decorative labels.

- Seen is abbreviated when required by available width, for example `6.7K` or `3.5M`.
- Captured values remain exact and are never abbreviated.
- XP and economy values use compact formatting with useful precision, for example `3.01M` or `48.9K`.
- Profit includes an explicit positive sign when positive and uses positive/negative semantic tone.
- Supply symbols such as `✓`, `✕`, `$` and `↓` are visually secondary to the numeric value.

## 4. Rarity Tracker

Rarity tiers can be selected independently.

`Show Failed` OFF:

```text
Captured
```

`Show Failed` ON:

```text
Failed / Captured
```

Seen is intentionally not part of Rarity Tracker.

Captured keeps the rarity semantic color and stronger visual hierarchy. Failed and the separator absorb density reduction first. Five selected rarities use compact density; six or seven use dense mode.

Legacy `capturedRarities` configuration is normalized to `rarityTracker`.

## 5. Shiny Tracker

Shiny uses one combined tracker only:

```text
★ Seen / Captured
```

Rules:

- no separate Seen/Captured mode selector;
- Seen follows compact formatting;
- Captured stays exact;
- the star and Captured value use the same gold accent.

Legacy `shinySeen` and `shinyCaptured` configuration values normalize to `shinyTracker`.

## 6. Inventory tracking

Inventory values come from the page-owned PokePixel Inventory API through `userscript/inventory-state.js`.

### Balls

Ball usage is deterministic from persisted current-Hunt encounters, so reload does not require an additional usage counter.

### Potions

The client does not always expose a stable potion item id in the canonical potion-use event. Per-potion usage is therefore derived from decreases between authoritative Inventory snapshots.

Rules:

- a quantity decrease increments usage for that Potion;
- a refill/purchase that increases quantity becomes the new baseline and does not count as use;
- usage is scoped by local `sessionId`;
- reload during the same Hunt preserves usage;
- a new Hunt resets the counter.

Potion usage state is persisted in localStorage under:

```text
pokepixel_hunt_analyzer_potion_usage_v1
```

This is presentation/support state only; analytics data remains in IndexedDB.

## 7. Sound Alerts global mute

Sound Alerts expose a global speaker control in the section header.

Mute:

- blocks new alert playback;
- preserves all per-event Sound 1 / Sound 2 / Custom selections;
- persists across reload.

Mute state is stored in localStorage under:

```text
pokepixel_hunt_analyzer_audio_muted_v1
```

The existing eight alert combinations remain unchanged: Epic, Legendary, Mythical and Shiny, each with Captured and Fled outcomes.

## 8. Runtime boundaries

The Closed HUD reuses state already loaded for Current plus the Inventory snapshot. It does not add a new continuous polling loop.

Relevant modules:

```text
userscript/closed-hud.js
userscript/closed-hud-runtime.js
userscript/inventory-state.js
userscript/audio-alerts.js
userscript/audio-alerts-runtime.js
```

`closed-hud.js` owns the catalog, aggregation, configuration and base rendering. `closed-hud-runtime.js` remains a small runtime/presentation compatibility layer. `audio-alerts-runtime.js` adds the global mute behavior around the existing Sound Alerts implementation.

## 9. Release invariants for v1.12.0

The feature ships with:

- no IndexedDB migration;
- no protocol contract change;
- no new dependency;
- no new Tampermonkey grant or `@connect` permission;
- no gameplay automation.

Manual production smoke validation covered the complete widget catalog, per-Ball metrics, Potion usage/refill/reload behavior, Rarity/Shiny formatting, configuration persistence, Sound Alerts mute and reload hydration behavior.
