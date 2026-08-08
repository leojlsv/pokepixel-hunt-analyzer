# Architecture

## 1. v1 scope

v1 keeps the current extension standalone and adds persistent local analytics.

Included:
- Edge/Chromium MV3 and Side Panel;
- passive inbound WebSocket observation;
- IndexedDB;
- local Hunt sessions;
- normalized encounters;
- immutable configuration snapshots;
- history, comparison and JSON export.

Not included:
- Native Messaging;
- SQLite or direct `%LOCALAPPDATA%` writes;
- local/cloud backend;
- raw WebSocket archive;
- gameplay automation;
- DPS simulator.

## 2. Target flow

```text
PokePixel WebSocket
        ↓
hook.js (MAIN world)
        ↓ minimal normalized page event
content.js (ISOLATED world)
        ↓ validation
service worker / event router
        ↓
session + config + encounter services
        ↓
IndexedDB
        ↓
analytics
        ↓
Side Panel
```

The current root-level `background.js` remains valid during migration. Split it only when a phase has tests and a concrete responsibility boundary.

Planned modules may live in:

```text
background/
domain/
data/
services/
tests/
```

Do not move working files merely to satisfy this tree.

## 3. Responsibilities

### `hook.js`
- observe inbound WebSocket messages;
- allowlist relevant event types;
- parse defensively;
- extract minimum required fields;
- emit normalized messages.

It must not persist data, calculate analytics, alter the socket, or send game commands.

### `content.js`
Validate `event.source`, origin, channel, event type and field types before forwarding to the extension runtime.

### Service worker
Coordinates domain operations and persistence. Business rules should gradually move out of a monolithic background file into testable modules.

## 4. IndexedDB

Database: `pokepixel_hunt_analyzer`

Minimum stores:

```text
meta
sessions
configs
encounters
```

### `sessions`

```text
sessionId
status                  running | paused | ended
startedAtMs
endedAtMs
activeStartedAtMs
accumulatedActiveMs
lastActivityAtMs
serverSessionId         adopted from the first combat.started's session.id; null until then
zoneId                  adopted from the first combat.started's enemy.zone_id; null until then
locked                  set by manual Pause/End Hunt; only manual Resume/New Hunt clears it (§7)
createdAtMs
updatedAtMs
```

`serverSessionId`/`zoneId`/`locked` are not a fixed schema in the IndexedDB sense (object stores are schemaless beyond `keyPath`/indexes), just additional fields the session row always carries.

Index: `startedAtMs` (v2 migration — added for History's paginated, recency-ordered list; `sessions` had no index before Fase 4).

Prefer deriving historical totals from encounters first. Add cached session aggregates only if a measured UI/query need justifies them.

### `configs`

```text
configId
schemaVersion
expRateLabel
captureConfig
captureConfigSource     protocol | manual | unknown
canonicalJson
createdAtMs
```

Config rows are immutable. Editing the effective configuration creates a new `config_id`.

### `encounters`

```text
encounterId
sessionId
configId
groupKey
socketId
serverSessionId
wildMonsterId
speciesId
speciesName
level
quality
ivTotal
isShiny
mapId
zoneId
elements                array of strings, from combat.started.enemy only
gender                  from combat.started.enemy only, informational (not a filter)
nature                  from combat.started.enemy only, informational (not a filter)
startedAtMs
lootAtMs
captureAtMs
cycleMs
exp
trainerExp
pokemonExp
gold
lootSellValue
captureResult           success | failed | none | unknown
capsuleItemId
capsuleName
captureChance
supplyCost
autoSold
autoSellValue
state                   started | looted | success | failed | incomplete | orphan
createdAtMs
updatedAtMs
```

Persist only protocol-supported fields. Unknown values remain null/unknown.

`elements`/`gender`/`nature` (Fase 4) needed no schema migration to add —
object stores are schemaless beyond `keyPath`/indexes, same as
`sessions.serverSessionId`/`zoneId` (§7). `capture.success.creature`'s
own `elements`/`gender`/`nature` are never used to overwrite these —
same non-overwrite policy as `level`/`quality` (§6,
docs/PROTOCOL_AND_ANALYTICS.md §5).

Initial indexes: `sessionId`, `groupKey`, `speciesId`, `quality`, `startedAtMs`.

## 5. Identity

`encounter_id` is generated locally with `crypto.randomUUID()` and is the permanent identity of one normalized encounter.

`wild_monster_id` is a temporary event-correlation key. It may be reused and is never the IndexedDB primary key.

`config_id` is a deterministic SHA-256 hash of canonical configuration: schema version + EXP rate state + normalized `auto_capture` snapshot.

`group_key` is:

```text
species_id | level | config_id
```

The ball actually used in one attempt is encounter data, not part of the group key.

## 6. Capture configuration

The real protocol exposes `session.auto_capture` in `combat.started`. Use that snapshot as the preferred capture-config source when present.

Confirmed fixture fields include:

```text
enabled
mode
capsule_item_id
common_enabled
common_capsule_item_id
min_quality
shiny_enabled
shiny_capsule_item_id
species_filter
```

Do not invent a richer rarity model unless the protocol later proves one.
EXP rate stays manual/unknown until a reliable protocol field is confirmed.
The encounter snapshots the active config at `combat.started`; later changes apply to the next encounter.

## 7. Session timing

Authoritative active time:

```text
active_ms = accumulatedActiveMs + (now - activeStartedAtMs), when running
```

`setInterval` is presentation only. `hunt.stopped` pauses. `New Hunt` closes the current session and creates a new local session.

### Automatic Hunt lifecycle

A local session starts automatically on the first valid Hunt activity;
there is no explicit "start" action.

- `hunt.stopped` pauses the session; it never ends it.
- `hunt.analyzer_reset` alone never creates a new session — it is only an
  activity/resume signal (docs/PROTOCOL_AND_ANALYTICS.md).
- The same `serverSessionId` + `zoneId` observed after a pause is a resume
  of the current session, not a new one.
- A confirmed new `serverSessionId` is a new Hunt.
- An isolated `zoneId` change alone is only a candidate transition — it
  does not end the session until confirmed.
- `combat.started` is the preferred authoritative confirmation for a
  session-boundary decision.
- A `config_id` change never creates a new Hunt; config changes only
  affect later encounters (§6).
- `New Hunt` is a manual override: it always closes the current session
  and starts a new one, regardless of the automatic rules above.
- Manual Pause/End Hunt set `sessions.locked = true`: while locked, no
  automatic signal above (resume, retarget, new-session confirmation) may
  touch the session — only a manual Resume or New Hunt clears the flag.
  Without this, an automatic resume on the next `combat.started` would
  silently undo a deliberate Pause/End Hunt.

### Browser restart recovery

Do not count browser-closed time. If persisted state says `running` on startup:

```text
accumulatedActiveMs += max(0, lastActivityAtMs - activeStartedAtMs)
status = paused
activeStartedAtMs = null
```

Resume on the next valid Hunt activity.

## 8. Edge profile assumption

v1 assumes one active game account/session per Edge profile. Explicit multi-account support within one profile is post-v1.

## 9. History, Compare, export, deletion (Fase 4)

The Side Panel has three tabs: Current (live), History and Compare.
History/Compare are not polled — they load on tab switch or after a
mutating action; only Current refreshes on the 1s interval.

### History

Keyset (cursor-based) pagination over `sessions.startedAtMs` via
`sessionsRepository.getPage({ limit, before, after })`
(`IDBKeyRange.bound` + an index cursor, direction `"prev"`) — chosen over
offset pagination so it stays cheap as history grows. The same method
serves both "next page" and the date-range filter (`after`/`before` are
just narrower bounds).

Selecting a session shows its encounters, including the qualitative
fields captured in §4 (`elements`, `gender`, `ivTotal` shown as `n/186`)
— no technical IDs (`wildMonsterId`, `capsuleItemId`, full `configId`)
ever reach this view.

Deleting a session (`sessionsRepository.deleteSession`) never touches
`configs` (config snapshots are shared/immutable, §5) and clears
`meta.currentSessionId` only if the deleted session was the current one.
Callers must delete that session's encounters first
(`encountersRepository.deleteBySessionId`, via the `sessionId` index) —
`deleteSession` only removes the `sessions` row.

### Compare

A "Tema" (theme) selector switches between two aggregations over the
same filtered encounter set — a mode toggle, not a data filter, so it
doesn't start at `All (*)` like the three filters beside it:

- **By Cycle** (default): groups by `groupKey` (§5) in memory —
  `encountersRepository.getAll()` plus a `Map`, no aggregate table.
  Per-group metrics use `domain/groupMetrics.js`
  (`docs/PROTOCOL_AND_ANALYTICS.md §11`, Cycle EXP/h) rather than
  `domain/sessionMetrics.js` — a group spans encounters from many
  sessions, so "per session active time" does not apply;
  `group_cycle_ms` (the sum of each encounter's `cycleMs`) is the
  group's own denominator. Config is never shown (no column, no hash,
  no raw `auto_capture` snapshot) — `groupKey` already encodes it, and
  the UI has no use for the raw id.
- **By Rarity**: the exact same table as Current's own By Rarity (§2) —
  one row per rarity tier (Weak…Mythical, always all 7, even at zero),
  Seen/Captured/Failed/Rate — computed by
  `domain/rarityBreakdown.js`'s `computeRarityBreakdown()` over
  Compare's filtered, cross-session encounter set instead of one
  session's. That function is shared with `domain/sessionMetrics.js`
  (which uses it for Current) rather than duplicated, since the
  bucketing rule is identical either way.

Three dropdown filters (Pokémon / Pokébola / Elemento), all starting at
`All (*)`, populated from distinct values actually present in the
fetched encounters (not a fixed list) and applied to the encounter array
*before* either grouping above. `elements` is the only qualitative field
that is also a filter (§4); `gender`/`nature` are display-only. Species
names are capitalized for display (`speciesName` already comes
capitalized from the protocol; an unresolved encounter's fallback
`speciesId` slug is capitalized in the UI instead of shown raw).

`populateSelect`'s helper-function parameters are deliberately named
`toValue`/`toLabel`, never `valueOf`/`toString`/other
`Object.prototype` member names — a plain object always inherits those
from the prototype chain, so a default like `{ valueOf = (o) => o } =
{}` silently never applies (`{}.valueOf` resolves to
`Object.prototype.valueOf`, never `undefined`) and throws the moment
it's invoked as a bare function. This caused a real bug: the Pokébola/
Elemento dropdowns never populated because the second `populateSelect`
call (the first one without an explicit `valueOf`/`labelOf` override)
threw and aborted the rest of `loadCompare()`.

### Export

JSON only (no CSV, despite `docs/DEVELOPMENT.md §3` mentioning it —
simplified during Fase 4 planning). `domain/export.js` builds
`{ formatVersion, appVersion, sessions, configs, encounters }` from
already-fetched rows; the Side Panel downloads it via `Blob` +
`<a download>`, so no `downloads` permission is needed in the manifest.
