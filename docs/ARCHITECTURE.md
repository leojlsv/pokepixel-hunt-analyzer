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
- history, comparison and CSV/JSON export.

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
createdAtMs
updatedAtMs
```

`serverSessionId`/`zoneId` are the inputs to the Automatic Hunt lifecycle boundary decision (§7) — they are not a fixed schema in the IndexedDB sense (object stores are schemaless beyond `keyPath`/indexes), just two additional fields the session row always carries once adopted.

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
