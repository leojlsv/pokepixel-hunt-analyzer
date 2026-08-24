# Capture Tickets

Development specification for manually generated capture tickets.

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

## Sprite

Sprites use PokémonDB Black/White assets:

```text
https://img.pokemondb.net/sprites/black-white/normal/{pokemon}.png
https://img.pokemondb.net/sprites/black-white/shiny/{pokemon}.png
```

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

Layout values are centralized in `userscript/capture-ticket.js` as `TICKET_LAYOUT` and preserve the Photoshop point-size references supplied for validation.

## Artwork metadata

Downloaded PNGs receive non-visible PNG text metadata before export:

- `Author=Rhyxus`
- `Artwork=Capture ticket frame designed by Rhyxus`
- `FrameFingerprint=rhyxus.pp-prize-ticket.v1`
- `FrameAssetSHA256=<theme frame hash>`
- `Software=PokePixel Hunt Analyzer`
- `Theme=<legend|mythic|shiny>`

This is attribution/fingerprinting, not DRM; PNG metadata can be removed by image re-encoding.

## Temporary validation surface

`userscript/capture-ticket-dev-harness.js` adds Legend / Mythic / Shiny sample buttons to Misc so all three templates can be validated without waiting for a rare live capture.

The harness is temporary and must be removed before the production release. The real `Generate Ticket` action remains tied to eligible Captured encounter detail rows.
