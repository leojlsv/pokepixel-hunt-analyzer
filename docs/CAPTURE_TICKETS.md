# Capture Tickets

Specification for manually generated Capture Tickets and the `Misc > Catch Gallery` surface.

## Eligibility

A ticket is available only for a persisted `capture.success` encounter with complete current-format data and one of:

- `isShiny === true`
- `quality === "legendary"`
- `quality === "mythical"`

Theme priority is `Shiny > Mythic > Legend`.

Historical encounters that predate `captured_by_name` are not backfilled and are intentionally ineligible.

## Data source

The renderer consumes one persisted encounter:

- Pokémon: `speciesName`
- rarity: `quality`
- numeric quality: `qualityMultiplier`
- total IV: `ivTotal`
- Shiny: `isShiny`
- player: `capturedByName`, normalized from `capture.success.captured_by_name`
- timestamp: `captureAtMs`

No new IndexedDB store, index, schema version or migration is required.

## Catch Gallery

The user surface is `Misc > Catch Gallery`, directly below Sound Alerts.

The gallery is a compact collapsible table with columns:

- Pokémon
- Captured
- Quality
- IV
- actions

Legendary and Mythical names use the analyzer's established rarity colors. Shiny overrides the rarity color: the Pokémon name is silver and receives a `★` marker.

Controls:

- Pokémon text filter
- rarity filter: All / Legendary / Mythical / Shiny
- sortable Captured, Quality and IV headers; clicking the active header toggles ascending/descending
- pagination capped at 5 captures per page
- `Generate` opens the Capture Ticket preview/download flow
- `Copy` generates the same PNG and writes it to the browser image clipboard so it can be pasted into compatible targets such as Discord

The image clipboard path uses `navigator.clipboard.write()` with a PNG `ClipboardItem`.

When no eligible captures exist, only the table column headers remain; no blank rows or empty-state card are rendered.

The gallery performs a whole-store encounter read only when Misc is explicitly opened or when a successful capture marks the visible gallery dirty. It is not part of the one-second Current refresh loop. Filtering, sorting and pagination run in memory over the loaded eligible set.

## Sprite

Sprites use PokémonDB Black/White assets:

```text
https://img.pokemondb.net/sprites/black-white/normal/{pokemon}.png
https://img.pokemondb.net/sprites/black-white/shiny/{pokemon}.png
```

Tampermonkey fetches the sprite with `GM_xmlhttpRequest` and `@connect img.pokemondb.net`, avoiding page-origin CORS and tainted-canvas export failures.

The 96×96 source is drawn at 192×192 with image smoothing disabled.

## Layer order

```text
backpaper
Pokémon sprite
frame
text
```

Canvas size is 303×500.

## Text

Font: Silkscreen.

```text
POKÉMON NAME
QUALITY {qualityMultiplier} · IV {ivTotal}
CAPTURED BY {capturedByName}
{YYYY-MM-DD HH:mm:ss}
```

The Google Fonts stylesheet and Silkscreen face are fully awaited before Canvas rendering, including the first generation after page reload.

Final visually validated layout values live in `userscript/capture-ticket.js` as `TICKET_LAYOUT`.

## Artwork metadata

Downloaded PNGs receive non-visible PNG text metadata before export:

- `Author=Rhyxus`
- `Artwork=Capture ticket frame designed by Rhyxus`
- `FrameFingerprint=rhyxus.pp-prize-ticket.v1`
- `FrameAssetSHA256=<theme frame hash>`
- `Software=PokePixel Hunt Analyzer`
- `Theme=<legend|mythic|shiny>`

This is attribution/fingerprinting, not DRM; PNG metadata can be removed by image re-encoding.

The Legend, Mythic and Shiny validation exports were confirmed to contain these PNG `tEXt` chunks with valid CRCs.

## Validation

Manual smoke tests approved:

- Silkscreen on first generation after reload
- Legend / Mythic / Shiny visuals
- PNG metadata/fingerprint
- Catch Gallery collapse / expand
- five-row pagination
- Pokémon filter
- rarity filters
- Captured / Quality / IV sorting in both directions
- Generate preview/download
- Copy image and paste into Discord

The temporary Catch Gallery harness used for this validation has been removed. Production behavior now uses only persisted real captures.
