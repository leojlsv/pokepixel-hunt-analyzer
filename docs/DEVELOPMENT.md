# Development

## 1. Security

The extension is passive.

Never persist:

```text
tokens
Authorization headers
cookies
authenticated WebSocket URLs
raw WebSocket frames
```

Keep manifest permissions narrow. Analytics failures must fail closed: the game must keep working.

## 2. Side Panel target

Views: `Current`, `History`, `Compare` (tabs; no separate `Config` view
— removed in Phase 3, config detail does not surface as raw
technical/UUID data anywhere in the UI, see docs/ARCHITECTURE.md §9).

Current should show Hunt status/time, Trainer and Pokémon EXP totals/h, Dollar totals/h, Seen/Captured/Failed, rates, rarity and shiny.

Actions: `New Hunt`, `Pause/Resume`, `End Hunt`.

The legacy `Reset` action and its `chrome.storage.session` counter are
retired once `Current` reads only from the v1 data; the toolbar badge
then derives from the v1 session/encounters, not from the legacy
counter.

History is paginated session history and detail (docs/ARCHITECTURE.md §9).
Compare aggregates either by `species + level + config` ("By Cycle") or
by rarity tier, identical to Current's own By Rarity table ("By Rarity"),
selectable via a "Tema" toggle (docs/ARCHITECTURE.md §9).
Capture config prefers protocol-derived `auto_capture`; EXP rate remains manual/unknown until protocol support is proven.

## 3. Export

JSON only — no CSV (simplified during Fase 4 planning; earlier drafts of
this document sketched CSV column sets, since removed). The backup
contains `formatVersion`, `appVersion`, `sessions`, `configs`,
`encounters` — a direct passthrough of already-fetched rows
(`domain/export.js`). No raw/auth data.

## 4. Preview

Keep the current browser-only preview independent of Chrome extension APIs. Reuse production CSS and deterministic mock data. Do not move it until a UI phase explicitly requires it.

## 5. Minimum tests

Domain/persistence:
- canonical config serialization;
- same semantic config → same hash;
- EXP-rate change → new `config_id`;
- `auto_capture` change → new `config_id`;
- deterministic `group_key`;
- IndexedDB create/read/update/migration;
- running/paused/restart time behavior;
- per-hour formulas and capture rates.

Parser/tracker:
- start → loot;
- start → loot → failed;
- start → loot → success;
- auto-sold success;
- no capture event;
- wild-id reuse;
- orphan;
- duplicate event;
- reconnect / seq reset;
- config change between encounters;
- nested success quality;
- captured creature level does not overwrite target level.

Fixture regression validates the event and Rare+ baselines in `docs/PROTOCOL_AND_ANALYTICS.md`.

## 6. Implementation phases

### Phase 1 — Foundation
- domain config/hash/group key;
- IndexedDB + migrations;
- repositories;
- unit/integration tests.

No UI or WebSocket behavior change.

### Phase 2 — Event pipeline
- normalized event contracts;
- local `socketId`;
- session service;
- encounter tracker;
- reuse/orphan/dedupe handling;
- fixture regression.

### Phase 3 — Current + Config
- migrate current Side Panel to new source of truth;
- automatic Hunt lifecycle and manual overrides (docs/ARCHITECTURE.md §7);
- protocol `auto_capture` snapshot;
- manual EXP rate;
- preview update;
- retire the legacy Reset action/counter; toolbar badge moves to v1
  session/encounter data.

### Phase 4 — History + Compare + Export
- history and filters;
- grouped comparison;
- JSON export;
- deletion controls.

### Phase 5 — Hardening + Release
- migration robustness;
- restart recovery;
- diagnostics;
- performance;
- documentation;
- final release checklist.

## 7. Git

Use SemVer. Preserve the working baseline before migration:

```text
commit baseline
tag v0.3.0
```

Prefer small commits. Do not commit release ZIPs, user exports, temporary logs/debug captures, secrets or machine-local Claude settings. Do not ignore intentional test fixtures.

## 8. v1.0.0 acceptance

- IndexedDB history survives Edge restart;
- browser-closed time is not counted;
- migration path is tested;
- encounter IDs are local UUIDs;
- wild ID is never DB PK;
- config hash and group key are deterministic;
- protocol `auto_capture` is captured when present;
- config changes affect only later encounters;
- wild-id reuse does not merge unrelated encounters;
- session and cycle metrics are clearly separated;
- Current, History and Compare work;
- JSON export and deletion work;
- fixture regression passes;
- no token/raw frame is persisted;
- preview works.

## 9. Diagnostics

Safe counters only:

```text
events_received
events_ignored
parse_errors
db_errors
orphan_events
duplicate_events
active_encounters
db_version
app_version
```
