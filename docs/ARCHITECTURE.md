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

History is persisted for analytics and Compare, but there is no History UI. Export is not part of the current product.

## 2. Runtime flow

```text
PokePixel WebSocket
        ↓
userscript/websocket-observer.js
        ↓ parsed inbound payload
userscript/main.js
        ↓ allowlist + serialized queue
services/eventPipeline.js
        ↓
domain/* + data/*
        ↓
IndexedDB
        ↓
userscript/current-view.js / compare-view.js
```

`userscript/main.js` is an orchestrator. It should not accumulate protocol parsing, persistence rules or UI implementation details.

## 3. Module boundaries

### `userscript/`

Browser/runtime boundary.

- `main.js` — initialization, repositories, pipeline queue, refresh scheduling and view orchestration.
- `websocket-observer.js` — passive WebSocket constructor interception and frame decoding.
- `tab-leadership.js` — localStorage lease that elects one ACTIVE tab.
- `ui.js` — UI lifecycle, interaction and persisted UI state.
- `ui-markup.js` — static analyzer markup.
- `current-view.js` — renders Current, rarity breakdown, Captured/Failed and HUD values.
- `compare-view.js` — Compare filtering, grouping, sorting and rendering.
- `ui-utils.js` — presentation-only formatting/helpers.
- `styles.js` — Shadow DOM CSS.

Browser-specific APIs should remain in this layer.

### `services/`

Application coordination.

`eventPipeline.js` receives normalized runtime events and coordinates session/config/encounter operations. It is the integration boundary between protocol events and persistence.

### `domain/`

Business rules and pure calculations where possible:

- protocol normalization;
- encounter correlation/state transitions;
- Hunt lifecycle/timing;
- configuration canonicalization/hash;
- group identity;
- rarity and metrics aggregation.

Domain modules must not depend on DOM, Tampermonkey or Chrome APIs.

### `data/`

IndexedDB access only:

- database opening/migrations;
- repositories;
- diagnostics persistence.

UI code should not use raw IndexedDB transactions directly.

### `tests/`

- `unit/` — deterministic domain/helpers.
- `integration/` — IndexedDB repositories, event pipeline and fixture regression.
- `fixtures/` — sanitized protocol fixture data only.

## 4. Persistence

Database:

```text
pokepixel_hunt_analyzer
```

Current schema version: `2`.

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
```

See `docs/PROTOCOL_AND_ANALYTICS.md` for protocol field ownership and metric semantics.

### Migration rule

Never edit a migration that may already exist in a user's browser. Add the next schema version and migrate forward.

IndexedDB object stores are schemaless beyond keys/indexes, so adding ordinary row properties does not require a migration.

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

Observed event types are defined by `domain/events.js` and allowlisted before entering the pipeline.

Important rules:

- protocol normalization belongs in `domain/events.js`;
- frames outside the allowlist are ignored early;
- events are processed through one Promise queue to preserve ordering;
- `socketId | eventType | seq` is used for reconnect-safe dedupe;
- `wildMonsterId` correlates a temporary encounter but is never the DB primary key;
- repeated `combat.started` for the same individual must not create duplicate encounters;
- potion-only `loot.received` events update session expenses and do not create encounters.

## 7. Hunt timing and metrics

Authoritative elapsed Hunt time is derived from timestamps and accumulated active milliseconds.

Never use an incrementing UI timer as the source of truth.

Time while the browser is closed is not counted as active Hunt time.

`domain/sessionMetrics.js` owns Current metrics. UI modules format and render those values; they should not duplicate formulas.

## 8. Multi-tab leadership

Only one game tab writes analytics at a time.

`tab-leadership.js` maintains a short-lived localStorage lease:

```text
ACTIVE   owns/refreshed the lease
STANDBY  another live tab owns the lease
```

A standby tab can take over after the active lease expires or is released on unload.

The lock is coordination state only; persistent Hunt data remains in IndexedDB.

## 9. UI state

The analyzer uses Shadow DOM to isolate its layout/styles from PokePixel.

LocalStorage stores presentation state only:

- panel/HUD position;
- panel size;
- Current/Compare view;
- open/minimized state;
- section collapse state;
- alpha level;
- active-tab lease.

Analytics data does not live in localStorage.

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

`scripts/build-userscript.mjs` injects the version from `package.json` and generates the Tampermonkey metadata block.

## 12. Non-goals

Do not add these without an explicit product decision:

- gameplay automation;
- backend/cloud storage;
- Native Messaging;
- SQLite or machine-local file writes;
- raw traffic archive;
- MV3/Side Panel compatibility layer;
- version-named runtime patch files.
