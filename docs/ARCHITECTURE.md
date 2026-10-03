# Architecture

## 1. Purpose

PokePixel Hunt Analyzer is a standalone Tampermonkey userscript for passive, local Hunt analytics.

Core invariants:

- observe inbound PokePixel WebSocket traffic only;
- never send, replay or modify gameplay messages;
- persist normalized analytics, never raw frames or authentication data;
- keep domain rules independent from browser UI;
- keep `package.json` as the single application-version source;
- keep one active analytics writer when multiple game tabs are open.

History is persisted locally and exposed through the History UI. Closed HUD configuration, Capture Tickets and custom audio remain client-side features; there is no Analyzer backend/cloud storage.

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
Current / History / Misc / Closed HUD
```

`userscript/main.js` is an orchestrator. It should not accumulate protocol parsing, persistence rules or detailed UI implementation.

## 3. Module boundaries

### `userscript/`

Browser/runtime boundary.

- `main.js` — initialization, repositories, pipeline queue, refresh scheduling and view orchestration.
- `websocket-observer.js` — passive WebSocket constructor interception and frame decoding.
- `protocol-adapter.js` — generation-specific protocol reconciliation; maps HuntSim frames/queues/rewards into canonical events while passing legacy events through unchanged.
- `tab-leadership.js` — localStorage lease that elects one ACTIVE tab.
- `ui.js` / `ui-markup.js` — panel lifecycle, navigation and static Analyzer markup.
- `current-view.js` — Current Hunt rendering.
- `current-loot-view.js` — Current-only Loot projection over the existing session's already-cached encounter rows. It reuses `aggregateLootHistory` and recomputes only on `lootDataRevision` changes, independently of the Captured/Failed list version and the 1-second timer. Optional inventory metadata drives item-name/rarity presentation; native rarity filtering is independent from Pokémon filters and cannot allocate per-item values out of encounter-level currency totals. An inventory refresh reclassifies visible entries without refetching all encounters.
- `loot-item-catalog.js` — read-only, bounded native item metadata resolver. Normalizes known item rarity values, including masculine/feminine Portuguese labels (`raro`/`rara`, `lendário`/`lendária`, etc., with/without accents); an observed real `getInventory()` item returned `map_fragment` with `rarity: "raro"` although the Bag used `rarity-rare`. Uses the Inventory API as primary authority, then explicitly identified item definitions and slots in the native Bag. The slots may belong to a **detached cached scene** from `PokeIdle.ReactiveWindows.cached()` or the current `SceneManager._scene`: querying only the live document misses these after the Bag closes. Scene access reads only existing `_panel.body` / `_items` and does not open windows or invoke gameplay. Slot rarity requires matching item ID or an *unambiguous* full accessible name; Pokémon slots, conflicting classes/definitions/IDs and throwing/disposed native objects fail closed. Slot evidence is indexed once per catalog refresh, and the reader throttles native scene scans to 2.5 seconds during ordinary Current redraws; a new Inventory snapshot refreshes immediately. Observed names/rarities are cached in-memory for the session to cover later sold drops; catalog-signature comparison reclassifies Current and History filters without a new loot event or full encounter aggregation. Rarity is never inferred from a `legendary_` item ID prefix. Native `_items` may omit stable IDs: only identity-confirmed entries can fill gaps in the API snapshot.
- `inventory-state.js` — supports Inventory API arrays in `data`, `items` or `inventory`, as well as nested `item.id/name/type/rarity`, while preserving the existing capsule/potion inventory tracking.
- `history-view.js` / `history-styles.js` — lazy History rendering and presentation. A serialized refresh/load-more loop discards outdated responses after a changed period or invalidated data version, and failed loads retain the previously committed session bundles with an explicit Retry control. Navigation reuses loaded pages until Current's session/status/encounter revision changes or the local day rolls over for relative date filters; deletion invalidates explicitly. While History is visible, a stale cache is indicated by Refresh • without throwing away already paged rows. Keyboard expansion restores focus to the replacement row across Hunts, Pokémon, Attempts and Loot; hidden Retry/Load More controls transfer focus to a persistent status element.
- `loot-history-model.js` — pure aggregate of already-loaded persisted encounter rewards by item ID and Pokémon source. It applies History's session and encounter filters, counts each item only once per encounter for Drops, and keeps encounter-level financial totals separate from item quantities. The Loot-only Item Rarity filter runs against authoritative inventory metadata *after* aggregation, with seven recognized rarities and a `none` fallback for absent/unrecognized metadata; inventory refresh reclassifies visible items without rescanning loaded encounters. Filtering by item rarity cannot change the encounter-level monetary totals because the protocol supplies no individual item prices. History's 20-session pagination bounds this aggregate to loaded sessions, and the UI says so. No timestamp is presented in the Loot tab.
- `loot-rarity-filter.js` — shared Current/History Loot item-rarity checkbox controller. Reuses Captured/Failed's All/None/partial-selection presentation, adds the independent `none` option, preserves separate Current/History selections in versioned localStorage, and treats corrupted or unavailable storage as All. Filters are applied after item aggregation, so toggling multiple rarities leaves monetary totals unchanged. Mobile uses the same touch-sized checkbox menu without a single-select proxy.
- `history-delete.js` — History DELETE control and destructive-action guard UI.
- `closed-hud.js` — Closed HUD catalog, configuration normalization, aggregation, inventory-aware display models and base rendering.
- `closed-hud-runtime.js` — small runtime/presentation compatibility layer around the Closed HUD, including early-paint guarding and compact supply-symbol presentation.
- `inventory-state.js` — page-owned Inventory snapshot normalization/reconciliation for Ball/Potion widgets.
- `audio-alerts.js` — built-in/custom audio controls and playback orchestration.
- `audio-alerts-runtime.js` — global persistent Mute/Unmute wrapper for Sound Alerts.
- `custom-audio-repository.js` — browser-side custom audio asset persistence.
- `catch-gallery.js` — Catch Gallery controls/filter/sort/pagination/actions.
- `capture-ticket.js` — Capture Ticket rendering and preview orchestration.
- `remote-image-loader.js` — bounded PokémonDB image cache, in-flight dedupe and request pacing.
- `png-metadata.js` — PNG metadata encoding/validation.
- `public-summary.js` — versioned read-only Current Hunt summary boundary and explicit
  Coupled Workspace embed marker handling.

Browser-specific APIs stay in this layer.

### Better UI public boundary

The Analyzer exposes bounded, versioned page-global contracts that keep its domain,
storage and UI internals private. Better UI is a consumer of these contracts; the
Analyzer does not import Better UI code, read its storage or depend on its DOM. Embed
mode itself remains explicit rather than inferred:

- the host injects `__POKEPIXEL_HUNT_ANALYZER_EMBED__ = { protocol: 1 }` before the
  Analyzer bundle at document start;
- protocol observation, the event pipeline, domain calculations and IndexedDB stay
  identical to the standalone Analyzer and remain authoritative;
- panel/HUD, audio controls, Catch Gallery, History controls and the broad diagnostics
  page global are not mounted in embed mode;
- `__POKEPIXEL_HUNT_ANALYZER_PUBLIC__` exposes only `protocol`, `appVersion` and a
  read-only `getSummary()` function returning a copy of the bounded Current summary;
- `__POKEPIXEL_HUNT_ANALYZER_CONTROL__` exposes only `pause`, `resume` and `reset`, and
  those actions still require the Analyzer tab to hold analytics leadership;
- standalone UI additionally exposes `__POKEPIXEL_HUNT_ANALYZER_UI__` with its own
  `protocol: 1` and an allowlisted `navigate(destination)` operation. Destinations are
  semantic (`current`, Current rarity/captured/failed/loot, and History
  hunts/pokemon/attempts/loot), so consumers never depend on Shadow DOM selectors,
  internal tab IDs, session IDs or encounter IDs. This bridge is installed only after
  the standalone UI mounts and is absent in embed mode;
- standalone keeps the normal Analyzer UI and diagnostics. When a public consumer is
  actively polling the summary, Current hydration also stays fresh while the Analyzer
  panel is on another view; the extra refresh stops after the reader becomes inactive;
- every available snapshot carries Analyzer-owned `capturedAtMs`, allowing consumers
  to reject a frozen source instead of treating transport heartbeats as data freshness;
- the bounded presentation summary includes the canonical Current-Hunt `Seen` counts
  for each rarity bucket (including `unknown`) plus the chance from the latest completed
  capture attempt. These values are projections of Analyzer-owned state, not formulas
  reproduced by the Coupled Workspace;
- latest capture chance is explicitly historical attempt context, not a prospective
  probability for the creature currently on screen. The Analyzer derives it only from
  terminal success/failed encounters with a finite timestamp and chance in `[0, 1]`;
- the latest-attempt value is cached inside the Analyzer: a full scan occurs only when
  the Current encounter list is already being reloaded, while terminal encounter changes
  update the cache incrementally. The ordinary 1-second Current refresh therefore reads
  the cached scalar rather than introducing another O(N) scan;
- attempt/special history includes bounded persisted `speciesId` plus finite non-negative
  `qualityMultiplier` when authoritative data exists; the generic and special
  history projections each expose at most the latest 32 entries, independently;
  loot history may include bounded
  dropped-item `{ itemId, qty }` pairs from HuntSim rewards, without inferred item metadata;
- the public summary intentionally excludes `sessionId`, encounter rows, raw frames,
  repositories, credentials and mutation/action APIs.
- the public summary carries `sessionGeneration`, `activityKind`, `startedAtMs` and
  `endedAtMs` for consumers that need the authoritative CURRENT lifecycle.
  `sessionGeneration` is a monotonic **runtime-local** ordinal incremented when
  the selected local session changes; it does not represent the local UUID,
  the server session ID or an Expedition run ID, and it resets after a userscript
  runtime restart. Pausing, resuming and finishing a session preserve its
  generation; starting the next Hunt or Expedition rotates it. `endedAtMs`
  is set while the current session is ended and cleared if an explicit Resume
  reopens that same session without rotating its generation. Consumers must
  not infer end events or reconstruct boundaries from clock/zone/map data.
- `currentSessionSpecies` mirrors only the most recent species in CURRENT's
  selected session; it is historical presentation data, not `currentTarget`.
  While an Expedition is running, both the public species and target are
  suppressed in favor of CURRENT's `EXPEDITION` heading.

Consumers must treat this public summary as presentation data. They must not bypass
it by reading Analyzer IndexedDB, re-parsing WebSocket frames or duplicating domain
formulas.

The UI bridge is an independent presentation capability. Adding or redesigning an
Analyzer screen must preserve the semantic destination mapping rather than preserve
its internal DOM. Additive public fields or destinations stay backward-compatible;
breaking changes require a new contract protocol while the previous protocol remains
available through a migration window.

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

Analytics database:

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
Expedition sessions use the same store, identified by `activityKind: "expedition"`
and `activityInstanceId: run_id`. Old rows without these fields remain Hunts.

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

IndexedDB object stores are schemaless beyond keys/indexes, so adding ordinary row properties does not require a migration. Schema v3 added the sparse `captureTicketAtMs` index. v1.12.0 adds no analytics migration.

Managed database connections close themselves on `versionchange`, preventing an older open game tab from unnecessarily blocking a schema upgrade.

Custom audio blobs are intentionally isolated in:

```text
pokepixel_hunt_analyzer_assets
```

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
- tracker state and the bounded dedupe registry are committed only after the
  event's persistence effects succeed, so a transient IndexedDB failure leaves
  the exact event retryable instead of consuming it in memory;
- `wildMonsterId` correlates a temporary encounter but is never the DB primary key; HuntSim uses a synthetic `huntsim:<server-session-or-zone>:<kill-seq>` value;
- repeated `combat.started` for the same individual must not create duplicate encounters;
- potion-only `loot.received` events update session expenses and do not create encounters;
- legacy `capture.success` never overwrites a complete combat-started individual snapshot; HuntSim successful captures may enrich missing fields from authoritative terminal `creature` data, but `creature.level` is never used as target level;
- duplicate HuntSim projections (`hunt.kill_reward`, `hunt.rewards`, capture projections in `hunt.events`) must not enter analytics twice.
- `expedition.run_started`, `run_updated` and `run_live` open or recover one
  local session per run ID; `expedition.run_finished` ends only that run.
  `remaining_seconds: 0` and `away: true` are not terminal indicators.
- the `meta` store remembers the most recently finished Expedition run ID.
  A delayed live tick cannot resurrect that run. New-session transitions
  retain the existing write gate and atomic pointer switch.
- the protocol adapter preserves a bounded previous-run correlation window
  for late HuntSim rewards and captures, discarding cross-activity payloads
  whose origin cannot be established.

### Tampermonkey page-window boundary

Production metadata uses:

```text
@sandbox raw
@grant GM_xmlhttpRequest
@grant unsafeWindow
@connect img.pokemondb.net
```

Privileged grants mean runtime code must not assume the userscript `window` is identical to the page JavaScript global.

The WebSocket observer and Inventory integration resolve page-owned objects explicitly. A grant/sandbox change requires live verification that `window.__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__ === true` and that real events still reach the pipeline.

## 7. Hunt timing and metrics

Authoritative elapsed Hunt time is derived from timestamps and accumulated active milliseconds. Never use an incrementing UI timer as the source of truth.

Time while the browser is closed is not counted as active Hunt time.

`domain/sessionMetrics.js` owns Current aggregate metrics. UI modules format/render those values and may derive presentation-only combinations from already-loaded Current state. The Closed HUD must not create a parallel analytics persistence model.

Current refresh uses revision-aware session caching. History and Catch Gallery perform explicit/lazy persistence reads and do not join Current's one-second refresh loop.

History pagination uses the `startedAtMs` index with primary-key `sessionId` as a deterministic tie-breaker. `loadHistoryPage` returns a continuation `{ startedAtMs, sessionId }`; `sessionsRepository.getPage({before, beforeSessionId})` includes strictly older pairs while retaining the legacy `before`-only exclusive date-range behavior. No IndexedDB migration is required. History Load More never commits stale rows after a period change and does not discard already loaded pages on failed reads.

## 8. Closed HUD

The Closed HUD reuses the same Current state passed by `main.js` plus Inventory snapshots. It introduces no new continuous analytics polling loop and no IndexedDB schema changes.

Layout/configuration rules, widget formulas and formatting are normative in [`CLOSED_HUD.md`](CLOSED_HUD.md).

Important runtime constraints:

- four fixed layout units in a 2x2 grid;
- standard widgets use one unit; Rarity Tracker may use one or two;
- configuration is presentation state, not analytics state;
- the launcher is hidden until first hydrated render to avoid legacy/zero-value flashes;
- Ball usage comes from current-Hunt encounters;
- per-Potion usage is derived from authoritative Inventory decreases and scoped by local `sessionId`.

## 9. Multi-tab leadership

Only one game tab writes analytics at a time.

`tab-leadership.js` maintains a short-lived localStorage lease:

```text
ACTIVE   owns/refreshed the lease
STANDBY  another live tab owns the lease
```

A standby tab can take over after the active lease expires or is released on unload.

The lock is coordination state only; persistent Hunt data remains in IndexedDB. Destructive History deletion is also accepted only from the ACTIVE Analyzer tab.

Startup recovery is also a writer operation. Initialization awaits an explicit leadership
acquisition decision, starts lease refreshes during initialization and revalidates ownership
immediately before applying browser-restart recovery to the current session. A STANDBY tab
never runs that recovery against the shared IndexedDB session, so opening or reloading a
second tab cannot pause or truncate the ACTIVE tab's Hunt clock.

Runtime analytics writes register an optional, database-scoped ownership check
(data/write-gate.js). The queue checks the ACTIVE lease and its leadership generation
again after any pending startup work; IndexedDB repositories also check ownership
before sending writes and after their requests succeed, aborting transactions when
leadership has been lost. New Hunt, Reset, initial End Hunt and deletion of the
current-session pointer keep their coupled sessions/meta writes in a single IDB
transaction. Encounter bulk deletion checks ownership throughout cursor iteration.
This protects against detected handoffs during asynchronous persistence and permits
read-only Current hydration in STANDBY. It does not constitute strict fencing between
localStorage and IndexedDB: a handoff in the tiny window after the last ownership
check but before an IDB commit is not atomic with the lease. An absolute cross-tab
guarantee would require moving the writer-ownership decision into a common
transactional authority (or an equivalent protocol).

## 10. UI/local state

The Analyzer uses Shadow DOM to isolate layout/styles from PokePixel.

LocalStorage stores presentation/coordination state only, including:

- panel/HUD position and panel size;
- active navigation and open/minimized state;
- section-collapse state and alpha level;
- Current Captured/Failed rarity selections (`pokepixel_hunt_analyzer_current_rarities_v1`, independent of the active Hunt);
- Closed HUD configuration (`pokepixel_hunt_analyzer_closed_hud_v1`);
- per-Hunt Potion inventory baseline/usage support (`pokepixel_hunt_analyzer_potion_usage_v1`);
- Sound Alert selection/settings and global mute (`pokepixel_hunt_analyzer_audio_muted_v1`);
- active-tab lease.

Analytics history does not live in localStorage. Custom audio blobs use their separate bounded IndexedDB asset database.

## 11. Security and privacy

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

## 12. Build and release

Production bundle entrypoint:

```text
userscript/main.js
```

Production build:

```bash
npm run build:userscript
```

Outputs:

```text
dist/pokepixel-hunt-analyzer.user.js
dist/pokepixel-hunt-analyzer.meta.js
```

`scripts/build-userscript.mjs` injects the version from `package.json` and generates the Tampermonkey metadata block. The default build targets PROD and preserves the historical production namespace. `npm run build:userscript:dev` uses a separate DEV identity/domain and intentionally omits update metadata.

CI performs a clean dependency install, a high-severity npm audit gate, the complete test suite and production userscript validation.

Release publication follows [`TAMPERMONKEY_UPDATES.md`](TAMPERMONKEY_UPDATES.md): validated changes merge to `main`, then an exact-main `publish/vX.Y.Z` branch triggers the guarded release workflow.

## 13. Non-goals

Do not add these without an explicit product decision:

- gameplay automation;
- backend/cloud storage;
- Native Messaging;
- SQLite or machine-local file writes;
- raw traffic archive;
- MV3/Side Panel compatibility layer;
- version-named runtime patch files.
