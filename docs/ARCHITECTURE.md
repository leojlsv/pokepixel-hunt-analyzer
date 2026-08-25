# Architecture

## 1. Purpose

PokePixel Hunt Analyzer is a standalone Tampermonkey userscript for passive, local Hunt analytics.

Core invariants:

- observe inbound PokePixel WebSocket traffic only;
- never send, replay or modify gameplay messages;
- persist normalized analytics, never raw frames or authentication data;
- keep domain rules independent from the browser UI;
- keep `package.json` as the single application-version source;
- keep one active analytics writer when multiple game tabs are open.

History is persisted locally and exposed through the History UI. Capture Tickets and custom audio remain client-side features; there is no Analyzer backend/cloud storage.

## 2. Runtime flow

```text
PokePixel WebSocket
        ↓
userscript/websocket-observer.js
        ↓ parsed inbound payload
userscript/protocol-adapter.js
        ↓ canonical legacy-shaped event(s)
userscript/main.js
        ↓ allowlist + serialized queue
services/eventPipeline.js
        ↓
domain/* + data/*
        ↓
IndexedDB
        ↓
Current / History / Misc surfaces
```

`userscript/main.js` is an orchestrator. It should not accumulate protocol parsing, persistence rules or UI implementation details.

## 3. Module boundaries

### `userscript/`

Browser/runtime boundary.

- `main.js` — initialization, repositories, pipeline queue, refresh scheduling and view orchestration.
- `websocket-observer.js` — passive WebSocket constructor interception and frame decoding.
- `protocol-adapter.js` — generation-specific protocol reconciliation; maps HuntSim frames/queues/rewards into canonical events while passing legacy events through unchanged.
- `tab-leadership.js` — localStorage lease that elects one ACTIVE tab.
- `ui.js` / `ui-markup.js` — panel lifecycle, navigation and static analyzer markup.
- `current-view.js` — Current Hunt rendering.
- `history-view.js` / `history-styles.js` — lazy History rendering and presentation.
- `history-delete.js` — History DELETE control and browser confirmation/availability state.
- `audio-alerts.js` — built-in/custom audio controls and playback orchestration.
- `custom-audio-repository.js` — browser-side custom audio asset persistence.
- `catch-gallery.js` — Catch Gallery controls/filter/sort/pagination/actions.
- `capture-ticket.js` — Capture Ticket rendering and preview orchestration.
- `remote-image-loader.js` — bounded PokémonDB image cache, in-flight dedupe and request pacing.
- `png-metadata.js` — PNG metadata encoding/validation.

Browser-specific APIs should remain in this layer.

### `services/`

Application coordination.

`eventPipeline.js` receives normalized runtime events and coordinates session/config/encounter operations. It is the integration boundary between protocol events and persistence. Derived persistence markers that depend on complete domain state, such as `captureTicketAtMs`, are assigned here rather than in raw protocol normalization or migrations.

`huntDeletion.js` owns deletion ordering and the destructive-action guard. Encounter rows are deleted before the session row, and the Running/Paused Current Hunt is never deletable; it must be ended first.

### `domain/`

Business rules and pure calculations where possible:

- canonical event normalization (`domain/events.js`);
- encounter correlation/state transitions;
- Hunt lifecycle/timing;
- configuration canonicalization/hash;
- group identity;
- rarity and metrics aggregation;
- audio alert policy;
- Capture Ticket eligibility/data;
- Catch Gallery filtering/sorting/pagination.

Domain modules must not depend on DOM, Tampermonkey or Chrome APIs.

### `data/`

IndexedDB access only:

- database opening/migrations;
- repositories;
- diagnostics persistence.

UI code should not use raw IndexedDB transactions directly.

### `tests/`

- `unit/` — deterministic domain/helpers and injectable browser-independent helpers.
- `integration/` — IndexedDB repositories, migrations, event pipeline and fixture regression.
- `fixtures/` — sanitized protocol fixture data only.

## 4. Persistence

Database:

```text
pokepixel_hunt_analyzer
```

Current schema version: `3`.

Stores:

```text
meta
sessions
configs
encounters
```

### `meta`

Small key/value state such as the current-session pointer and diagnostics counters.

### `sessions`

One local Hunt session per `sessionId`. Stores lifecycle/timing state plus session-level values such as potion costs.

Index:

```text
startedAtMs
```

### `configs`

Immutable configuration snapshots keyed by deterministic `configId`.

Changing effective configuration produces a new config row rather than mutating the previous snapshot.

### `encounters`

One normalized wild encounter per local `encounterId`.

Indexes:

```text
sessionId
groupKey
speciesId
quality
startedAtMs
captureTicketAtMs
```

`captureTicketAtMs` is sparse: only newly finalized, complete Legendary/Mythical/Shiny successful captures eligible for Capture Ticket generation receive that derived property. Catch Gallery walks this index newest-first with a bounded read instead of materializing the encounter store.

See `docs/PROTOCOL_AND_ANALYTICS.md` for protocol field ownership and metric semantics.

### Migration rule

Never edit a migration that may already exist in a user's browser. Add the next schema version and migrate forward.

IndexedDB object stores are schemaless beyond keys/indexes, so adding ordinary row properties does not require a migration. Adding `captureTicketAtMs` as an indexed query surface required schema v3. The migration creates the sparse index only and does not scan/rewrite historical encounters; the service pipeline assigns the field to future eligible captures.

Managed database connections close themselves on `versionchange`, preventing an older open game tab from unnecessarily blocking a schema upgrade.

Custom audio blobs are intentionally isolated in the separate browser database `pokepixel_hunt_analyzer_assets`; they are not part of the analytics schema.

## 5. Identity

```text
sessionId       local Hunt UUID
encounterId     local encounter UUID
wildMonsterId   temporary protocol correlation key
configId        deterministic configuration hash
groupKey        speciesId | level | configId
socketId        local WebSocket-instance identifier
```

`wildMonsterId` and protocol `seq` are never globally unique database identities.

## 6. Event processing

Observed raw payloads first pass through `userscript/protocol-adapter.js`. Legacy events pass through unchanged; HuntSim traffic may emit zero, one or multiple canonical events. Canonical event types are then defined/normalized by `domain/events.js` and allowlisted before entering the pipeline.

Important rules:

- generation-specific reconciliation/decoding belongs in `userscript/protocol-adapter.js`;
- canonical field normalization belongs in `domain/events.js`;
- raw frames that are neither canonical nor adapter inputs are ignored early;
- events are processed through one Promise queue to preserve ordering;
- `socketId | eventType | seq` is used for reconnect-safe dedupe;
- `wildMonsterId` correlates a temporary encounter but is never the DB primary key; HuntSim uses a synthetic `huntsim:<server-session-or-zone>:<kill-seq>` value;
- repeated `combat.started` for the same individual must not create duplicate encounters;
- potion-only `loot.received` events update session expenses and do not create encounters;
- legacy `capture.success` never overwrites a complete combat-started individual snapshot; HuntSim successful captures may enrich fields missing from the synthetic/unmatched target because terminal `creature` data is authoritative for those fields, but `creature.level` is never used as target level.
- duplicate HuntSim projections (`hunt.kill_reward`, `hunt.rewards`, capture projections in `hunt.events`) must not enter analytics twice.

### Tampermonkey page-window boundary

The production metadata currently uses:

```text
@sandbox raw
@grant GM_xmlhttpRequest
@grant unsafeWindow
@connect img.pokemondb.net
```

Privileged grants mean runtime code must not assume the userscript `window` is identical to the page's JavaScript global.

The WebSocket observer resolves the page window explicitly, preferring `unsafeWindow` and falling back to `window`. Any future integration with page-owned objects must follow the same rule. A grant/sandbox change requires live verification that `window.__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__ === true` and that real events still reach the pipeline.

## 7. Hunt timing and metrics

Authoritative elapsed Hunt time is derived from timestamps and accumulated active milliseconds.

Never use an incrementing UI timer as the source of truth.

Time while the browser is closed is not counted as active Hunt time.

`domain/sessionMetrics.js` owns Current metrics. UI modules format and render those values; they should not duplicate formulas.

Current refresh uses revision-aware session caching. History and Catch Gallery perform explicit/lazy persistence reads and do not join Current's one-second refresh loop.

## 8. Multi-tab leadership

Only one game tab writes analytics at a time.

`tab-leadership.js` maintains a short-lived localStorage lease:

```text
ACTIVE   owns/refreshed the lease
STANDBY  another live tab owns the lease
```

A standby tab can take over after the active lease expires or is released on unload.

The lock is coordination state only; persistent Hunt data remains in IndexedDB.

Destructive History deletion is also accepted only from the ACTIVE Analyzer tab.

## 9. UI state

The analyzer uses Shadow DOM to isolate its layout/styles from PokePixel.

LocalStorage stores presentation/settings state only, including:

- panel/HUD position and panel size;
- active Current/History/Misc navigation;
- open/minimized and section-collapse state;
- alpha level;
- audio alert selection/settings;
- active-tab lease.

Analytics data does not live in localStorage. Custom audio blobs use their own bounded IndexedDB asset database.

## 10. Security and privacy

Never persist or log:

```text
tokens
cookies
Authorization headers
authenticated WebSocket URLs
raw WebSocket frames
credentials
```

The observer attaches a `message` listener to WebSocket instances. It must not call `send`, rewrite frame data or modify gameplay behavior.

Capture Ticket BETA may load two classes of public render assets:

- Pokémon sprites from `img.pokemondb.net` through `GM_xmlhttpRequest`, cached in a bounded LRU and paced on cache miss;
- Silkscreen through Google Fonts before Canvas text rendering.

No Hunt payload, account credential or analytics database content should be attached to those asset requests.

Analytics failures must not intentionally block the game.

## 11. Build

Production bundle entrypoint:

```text
userscript/main.js
```

Build:

```bash
npm run build:userscript
```

Output:

```text
dist/pokepixel-hunt-analyzer.user.js
```

`scripts/build-userscript.mjs` injects the version from `package.json` and generates the Tampermonkey metadata block. The default build targets PROD and preserves the historical production namespace. `npm run build:userscript:dev` uses a separate DEV identity/domain for live protocol smoke testing.

CI performs a clean dependency install, a high-severity npm audit gate, the complete test suite and the userscript build.

## 12. Non-goals

Do not add these without an explicit product decision:

- gameplay automation;
- backend/cloud storage;
- Native Messaging;
- SQLite or machine-local file writes;
- raw traffic archive;
- MV3/Side Panel compatibility layer;
- version-named runtime patch files.
