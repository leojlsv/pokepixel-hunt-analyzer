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

Validates the sender of every message it acts on before touching the
database — `background.js`'s `chrome.runtime.onMessage` listener:
`protocol.event` must come from a tab on `https://pokepixel.nietore.com`
(`isPokePixelSender`); `session.new`/`pause`/`resume`/`end` must come
from one of this extension's own pages, never a content script
(`isOwnExtensionSender` — checks `sender.url`'s scheme is
`chrome-extension:`, not `sender.tab`'s presence, since a Side Panel
sender can carry a `tab` too). Neither is currently reachable by an
external page (no `externally_connectable` declared), but both fail
closed (`{ ok: false, error: "invalid_sender" }`) rather than assuming
that stays true forever.

## 4. IndexedDB

Database: `pokepixel_hunt_analyzer`

Minimum stores:

```text
meta
sessions
configs
encounters
```

### `meta`

Generic out-of-line-key store (no fixed record shape) — a plain
key/value bucket for whatever small pointers/bookkeeping don't warrant
their own object store. Two known keys today:

```text
currentSessionId      the current local Hunt's sessionId (§9,
                       data/sessionsRepository.js)
diagnosticsCounters   the 6 cumulative diagnostics counters (§13,
                       data/diagnosticsRepository.js) — the other 3
                       diagnostics fields are computed on demand, never
                       stored here
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
potionsUsed             count of auto-potion-used signals this session (§9 "Gastos")
potionsCost             Σ supply_cost of those signals — real protocol data, not a hardcoded price
createdAtMs
updatedAtMs
```

`serverSessionId`/`zoneId`/`locked`/`potionsUsed`/`potionsCost` are not a fixed schema in the IndexedDB sense (object stores are schemaless beyond `keyPath`/indexes), just additional fields the session row always carries.

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
qualityMultiplier       continuous quality score (e.g. 1.02), from combat.started.enemy only
ivs                     {hp,atk,def,spa,spd,spe}, from combat.started.enemy only (ivTotal is their sum)
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

`elements`/`gender`/`nature`/`qualityMultiplier`/`ivs` needed no schema
migration to add — object stores are schemaless beyond
`keyPath`/indexes, same as `sessions.serverSessionId`/`zoneId` (§7).
`capture.success.creature`'s own versions of these are never used to
overwrite them — same non-overwrite policy as `level`/`quality` (§6,
docs/PROTOCOL_AND_ANALYTICS.md §5).

Initial indexes: `sessionId`, `groupKey`, `speciesId`, `quality`, `startedAtMs`.

## 5. Identity

`encounter_id` is generated locally with `crypto.randomUUID()` and is the permanent identity of one normalized encounter.

`wild_monster_id` is a temporary event-correlation key. It may be reused and is never the IndexedDB primary key.

Reuse detection (`domain/encounterTracker.js`'s `applyCombatStarted`)
compares the full individual fingerprint (species/level/quality/gender/
nature/ivs/qualityMultiplier) before deciding a `wild_monster_id` was
actually handed to a new individual — the game sometimes re-announces
the same individual via a second `combat.started` for the same real
encounter (docs/PROTOCOL_AND_ANALYTICS.md §7). Treating that as reuse
used to finalize the real encounter as `incomplete` and create a
duplicate that stole the real result — confirmed at ~36% of persisted
encounters in one real backup before this fix.

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

### IndexedDB connection robustness (Fase 5, step 2)

`data/db.js`'s `openDatabase()` already handled `onblocked`/
`onupgradeneeded`/`onerror` correctly, but two real gaps had no
handling and no test coverage until this step:

- `background.js` memoized `openDatabase()`'s Promise
  (`dbPromise`/`eventPipelinePromise` for the derived pipeline) but
  never reset it on rejection. A rejected Promise is still truthy, so a
  transient failure (e.g. `onblocked` for a moment during an extension
  update, while an older Side Panel connection hasn't closed yet) used
  to be cached as permanently broken for that service worker's entire
  lifetime — every later event failing instantly without ever
  retrying. Both getters now reset their memo to `null` in a `.catch`
  before rethrowing, so the next message tries a fresh `openDatabase()`
  call instead of replaying a stale failure.
- `sidepanel/sidepanel.js`'s `openDb()` already closes its connection
  on `db.onversionchange` (correct — it's what lets another context's
  upgrade proceed), but afterward — or if `openDb()` fails on the very
  first attempt — the 1s poll (`loadAndRender()`) kept silently
  retrying against a dead/nonexistent connection forever, visible only
  as a repeating `console.error`. Both paths now call `showDbWarning()`
  (unhides `#db-warning`, reusing the existing `.warning` style from
  `#unknown-warning`) and, for the `onversionchange` case, `stopPolling()`
  (clears the interval) — the panel tells the user to close/reopen it
  instead of quietly doing nothing. `preview.html`/`preview.js` mirror
  the same `#db-warning` element for structural parity; it's never
  shown there since the preview has no real connection to lose.

`tests/integration/db.test.js` closes the coverage gap on the
`data/db.js` side: `onblocked` is now actually exercised (a second
connection opened while an older one deliberately doesn't close),
a migration that throws mid-upgrade is confirmed to abort the whole
transaction atomically (no partial index survives — a native IndexedDB
guarantee the whole migration system depends on but that had never
actually been verified against `fake-indexeddb`), and opening at a
version lower than what's already persisted is confirmed to reject
cleanly with no special-casing needed on our side.

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

Selecting a session shows its encounters — columns: Pokémon, Lvl,
Rarity (`quality`, the discrete tier), Qlt (`qualityMultiplier`, the
continuous score, §10), Gen. (Gender), IV (`ivTotal` shown as `n/186`),
Shiny, Res. (Result). No technical IDs (`wildMonsterId`,
`capsuleItemId`, full `configId`) ever reach this view, and `elements`
isn't shown here either — it's Compare's filter (§9 below), not a
History display field.

Deleting a session (`sessionsRepository.deleteSession`) never touches
`configs` (config snapshots are shared/immutable, §5) and clears
`meta.currentSessionId` only if the deleted session was the current one.
Callers must delete that session's encounters first
(`encountersRepository.deleteBySessionId`, via the `sessionId` index) —
`deleteSession` only removes the `sessions` row.

### Compare

A "Theme" selector switches between two aggregations over the
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
- **By Rarity**: the exact same table as Current's own By Rarity (§12) —
  one row per rarity tier (Weak…Mythical, always all 7, even at zero),
  Seen/Captured/Failed/Rate — computed by
  `domain/rarityBreakdown.js`'s `computeRarityBreakdown()` over
  Compare's filtered, cross-session encounter set instead of one
  session's. That function is shared with `domain/sessionMetrics.js`
  (which uses it for Current) rather than duplicated, since the
  bucketing rule is identical either way.

Three dropdown filters (Pokémon / Capsule / Element), all starting at
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
it's invoked as a bare function. This caused a real bug: the Capsule/
Element dropdowns never populated because the second `populateSelect`
call (the first one without an explicit `valueOf`/`labelOf` override)
threw and aborted the rest of `loadCompare()`.

### Export

JSON only (no CSV, despite `docs/DEVELOPMENT.md §3` mentioning it —
simplified during Fase 4 planning). `domain/export.js` builds
`{ formatVersion, appVersion, sessions, configs, encounters }` from
already-fetched rows; the Side Panel downloads it via `Blob` +
`<a download>`, so no `downloads` permission is needed in the manifest.

## 10. Seen, Dólar/h and Hunt expenses

Three metric corrections/additions made together, pre-Fase-5
(docs/PROTOCOL_AND_ANALYTICS.md §7/§10/§11 have the exact formulas):

- **Seen is now an exact identity**, `Seen = Captured + Failed`, computed
  in `domain/rarityBreakdown.js` (shared by Current, History and
  Compare's By Rarity) and independently in `domain/groupMetrics.js`
  (Compare's By Cycle). A `combat.started` that never got a capture
  attempt no longer inflates Seen.
- **Dólar/h includes a captured Pokémon's auto-sell value** whenever
  `encounter.autoSold` is true — previously only the wild monster's own
  `loot.received.gold` drop counted. Fixed in both
  `domain/sessionMetrics.js` and `domain/groupMetrics.js`.
- **Gastos/h (Pokébolas + Potions)**, new. Pokébolas is a pure
  aggregation over the already-persisted `encounter.supplyCost` — no
  pipeline change. Potions needed one:

  `loot.received`'s auto-potion-used variant (no `wild_monster_id`,
  docs/PROTOCOL_AND_ANALYTICS.md §3) is not tied to any specific wild
  encounter — it's a trainer-wide resource expense. `domain/
  encounterTracker.js`'s `applyLootReceived` special-cases it into a
  `session.potion_used` effect (`{ cost }`) instead of falling into the
  generic "no active encounter" orphan path — which is also a bug fix:
  before this, every auto-potion use created a bogus, all-null orphan
  encounter row (§9 above never had this problem since it only reads
  already-persisted data; this was a write-path bug in the pipeline
  itself, present since Fase 2).

  `services/eventPipeline.js` routes `session.potion_used` to
  `sessionsRepository.recordPotionUsed(cost)`, which — like
  `touchActivityAutomatic`/`pauseAutomatic` — reads/creates the current
  session, no-ops while `locked`, and calls the pure
  `domain/sessionTiming.js` transition (`recordPotionUsed`) that
  increments `potionsUsed`/`potionsCost` (§4). `domain/
  sessionMetrics.js` reads these two fields straight off the session row
  — the only metric here NOT summed from encounters, since potions have
  nothing to correlate to.

  Compare has no Gastos column: `potionsCost` is session-scoped, and
  attributing it to one `group_key` would mean inventing a split the
  protocol doesn't provide (docs/PROTOCOL_AND_ANALYTICS.md §11).

## 11. Captured list (Current view)

Below By Rarity (§12 — there is no separate Shiny section anymore):
every encounter of the current session with `captureResult ===
"success"`, one row per Pokémon — Pokémon / Nature / Quality (the
continuous `qualityMultiplier`, §10) / IV. Rarity (the discrete
`quality` tier) and Gender aren't separate columns — Rarity is a
colored bar on the Pokémon name (`.rarity-name`, same colors/classes as
By Rarity) and Gender is a ♂/♀ symbol on the name's other side, freeing
width in a narrow panel.

The IV column itself merges the 6 individual stats
(`ivs.hp/atk/def/spa/spd/spe`, docs/PROTOCOL_AND_ANALYTICS.md §2) into
one cell instead of 6 separate columns — header
`HP-ATK-DEF-SATK-SDEF-SPE`, cell e.g. `31-31-31-31-31-31`
(`formatIvBreakdown` in `sidepanel.js`/`preview.js`). The summed
`ivTotal` is deliberately not shown here — it was originally prefixed
onto the cell (`186 (31-31-31-31-31-31)`, with a matching `IV (...)`
header) but got dropped to save even more width, since it's not
essential once the 6 stats are visible; the "IV Total >" filter still
reads `encounter.ivTotal` directly, unaffected. Frees up enough
horizontal width that Nature stops getting clipped in a narrow panel.

The generic table CSS splits every non-first column evenly, which left
Nat/Qlt much wider than their short content needs while starving the
now much longer IV column — overflowing its fixed width instead of
wrapping (visible as a layout break in Edge's narrower side panel).
Fixed with a `.captured-table` class (only this table) giving explicit
per-column widths — Pokémon 26%, Nat 13%, Qlt 11%, IV the remaining
50% — plus `overflow-wrap: anywhere` on the Pokémon/Nat cells so an
unusually long name or nature wraps within its own cell instead of
bleeding into the next one.

If `encounter.isShiny`, the name also gets a trailing ` *` and the row
gets a `.captured-row-shiny` highlight (subtle gold tint) — the only
per-Pokémon shiny marker in this list, no separate column.

No new query: `sidepanel.js`'s existing per-poll
`encountersRepository.getBySessionId()` fetch (already used for
`computeSessionMetrics`) is reused as-is — filtering to `success` and
applying the 3 filters below all happen in memory, same approach as
Compare.

Three filters, all narrowing the already-`success`-filtered list:

- **Rarity** (dropdown, `All (*)` first): distinct `quality` values
  actually present among the current captures.
- **Quality >**: `qualityMultiplier > threshold` (2-decimal input).
  Empty input disables the filter.
- **IV Total >**: `ivTotal > threshold` (integer input, the existing
  summed field — the 6 individual stats are display-only here). Empty
  input disables the filter.

Current view only — History/Compare don't get this module or its two
new columns in this pass.

## 12. Current view layout QOL

Current's Hunt card was tall enough to push everything else below the
fold, so it was reflowed (`.hunt-metrics-layout`/`.hunt-metrics-grid` in
`sidepanel.css`, replacing the old flat 5-card `.hunt-metrics` grid):
Tempo alone on its own row, the other 4 metrics in a row below it.

The 4th metric card changed identity: it used to be "Gastos/h" (a rate);
it's now **"Lucro Total"** — `gold - expenses`, computed straight in
`sidepanel.js`'s `renderMetrics` (both terms already existed on
`computeSessionMetrics`'s output, no domain change needed) — and
deliberately has no per-hour rate at all, unlike every other card here.
Its `<small>` is just `↑ <gold total>` / `↓ <expenses total>`
(`.flow-in`/`.flow-out`, green/red) — no labels, no Potions (dropped
from this card; still tracked in the domain layer, just not surfaced
here). The `<strong>` gets a `.positive`/`.negative` class (green/red)
based on sign.

The Dólar card also flipped which number is primary: it shows the
gold **total** up front now, with `Dólar/h` demoted to the `<small>`
line — the opposite of every other card here, which leads with the
per-hour rate.

Any Hunt card value over 5 digits (≥ 100,000) gets its last 3 digits
abbreviated into a "K" suffix instead of wrapping/overflowing the
narrow card (`formatCompactNumber`/`formatCompactPerHour` in
`sidepanel.js`/`preview.js`, e.g. `185.673` → `186K`) — scoped to
the Hunt card only, not used anywhere else in the Side Panel.

Shiny no longer has its own section. `domain/rarityBreakdown.js`'s
`computeRarityBreakdown()` now tracks `shinySeen`/`shinyCaptured`/
`shinyFailed` per rarity tier (still just an annotation — always a
subset already counted in the plain seen/captured/failed) instead of
only the old single cross-tier `shiny` aggregate (kept, still computed,
just no longer read by the UI). By Rarity renders it as
`"Qty (ShinyQty)"`, the shiny count in gold (`.shiny-count`), whenever
it's non-zero.

Seen/Captured/Failed and Seen→Capture were briefly one 5-across
`.summary-grid` row together with Attempt Rate, replacing a 3-card row
plus a separate 2-card `.rate-row` below it (Current's own usage
only — History's detail summary is a different element that also
happens to be named `.rate-row`, untouched). `Seen`/`Captured`/`Failed`
are colored (`.count-seen`/`.count-captured`/`.count-failed` — light
blue/green/red, reusing colors already established elsewhere:
gender-male's blue, the running-status/positive-profit green, the
danger/negative-profit red).

Since then, the Attempt Rate card and the old `Rare+ Failed` accent
card were both dropped, and Seen→Capture's label shortened to just
"Capture" — `.summary-grid` is 4-across now. The Hunt card labels were
also translated to English (Elapsed Time / XP/h You / XP/h Poké /
Dollar / Profit) and the Lucro Total card's `↑ <gold total>` half was
dropped — it now shows only `↓ <expenses total>` (`.flow-out`), no
`.flow-in`. None of this touched `computeSessionMetrics`'s output —
`attemptRate` is still computed, just no longer read by the UI.

## 13. Diagnostics counters (Fase 5, step 1 — no UI yet)

The 9 safe counters from `docs/DEVELOPMENT.md §9` split into two kinds:

- **6 cumulative, persisted** in the `meta` store (already existed for
  `sessionsRepository.js`'s `currentSessionId` pointer) under a single
  `diagnosticsCounters` key: `eventsReceived`, `eventsIgnored`,
  `parseErrors`, `dbErrors`, `orphanEvents`, `duplicateEvents`.
  `data/diagnosticsRepository.js` is a thin read-modify-write wrapper
  (`getCounters()`/`increment(patch)`) — same shape as
  `data/configsRepository.js`. No new object store, no migration.
- **3 point-in-time, computed on demand**: `activeEncounters` (=
  `trackerState.inProgress.size`, only ever exists in the event
  pipeline's in-memory tracker state), `dbVersion` (=
  `SCHEMA_VERSION`), `appVersion` (injected into
  `createEventPipeline(db, { appVersion })` from
  `chrome.runtime.getManifest().version` by `background.js` — kept
  injectable, never imported directly, so `services/eventPipeline.js`
  stays testable in plain Node, same convention as its existing `now`
  parameter). These three would go stale the instant they're persisted
  with no reader, so they're never written to `meta` — only assembled
  live by `getDiagnosticsSnapshot()`.

Where each of the 6 persisted counters increments, all observed from
outside `domain/encounterTracker.js`/`domain/events.js` — neither
needed to change:

- `eventsReceived` — every message `services/eventPipeline.js`'s
  `handle()` is called with, valid or not.
- `eventsIgnored` vs `parseErrors` — when `normalizeEvent()` returns
  null, `EVENT_TYPES` (already exported by `domain/events.js`) tells
  the pipeline whether `message.type` is a type PokePixel Hunt Analyzer
  doesn't model at all (`eventsIgnored`, expected/deliberate) or a
  known type whose payload the normalizer rejected
  (`parseErrors`, e.g. `combat.started` with no `enemy` object).
- `duplicateEvents` — once normalized, the only way `applyEvent()`
  produces zero effects for a known event type is its own exact
  `socketId|type|seq` dedupe (§7). Every other known event type always
  emits at least one effect, so `result.effects.length === 0` is an
  unambiguous signal.
- `orphanEvents` — counted whenever `result.effects` contains an
  `encounter.create` whose `row.state === "orphan"` (§7's "wild-id
  reuse and orphans").
- `dbErrors` — incremented from `background.js`'s existing per-message
  `.catch()` blocks (`protocol.event` and every `session.*` action),
  best-effort, on top of the existing `console.error`.

Every increment call is wrapped in `.catch(() => {})` —
`docs/DEVELOPMENT.md §1`'s "Analytics failures must fail closed" means
a diagnostics write failing must never surface as a user-facing error
or block the real event/session handling it's observing.

No UI surfaces these yet (deliberate, for this step) —
`getDiagnosticsSnapshot()` exists and is tested so a future consumer
(a debug view, a console command, or folding them into the JSON export)
has a ready, correct data source without having to design the
collection logic again.

## 14. Performance audit (Fase 5, step 3)

Benchmarked the real pipeline against `tests/fixtures/
rhyxus_hunting2.regression.json` — 4324 real events, 3 Hunts, 4128
persisted encounters, the largest single session holding 2319 of
them. This is the largest realistic scale available in the project
(bigger than any single real Hunt is likely to get before a player
manually ends it), used to check the read paths that matter for a
responsive UI:

| Path | Measured cost |
|---|---|
| Current's 1s poll — `encountersRepo.getBySessionId()` + `computeSessionMetrics()`, worst case (the 2319-encounter session) | ~17-23ms/poll |
| Compare tab open — `encountersRepo.getAll()` (whole store, 4128 rows) | ~20-30ms |
| History page load — 3 sessions, sequential fetch+compute per row | ~55ms |

**Conclusion: no production code change needed.** The 1s poll spends
roughly 2% of its own budget even at this worst-case scale; Compare
and History are both well under what a user would perceive as slow.
The indexes already in place (`sessionId` on `encounters`,
`startedAtMs` on `sessions`, docs §4) are already the ones used on
these paths — nothing to add.

The one real finding was about the test suite, not the app:
`tests/integration/fixtureRegression.test.js` had 2 tests each
independently replaying the same 4324-event fixture through the real
pipeline against `fake-indexeddb` (a pure-JS polyfill, far slower
per-operation than a real browser's native IndexedDB) — ~25s per
replay, ~50s combined, out of a ~50-75s full `npm test` run. Fixed by
memoizing the replay (a cached Promise at module scope) so both tests
share one run's end state instead of repeating the expensive part —
same two independent pass/fail results, `npm test` total dropped to
~28s.
