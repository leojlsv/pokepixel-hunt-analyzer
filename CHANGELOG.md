# Changelog

All notable project changes should be recorded here.
The project follows Semantic Versioning.

## [Unreleased]

### Changed — Captured list IV column merge (pre-Phase 5)
- The 6 separate IV columns (HP/Atk/Def/SAtk/SDef/Spe) in the Current
  view's Captured table are now one column: header `IV
  (HP-ATK-DEF-SATK-SDEF-SPE)`, cell e.g. `186 (31-31-31-31-31-31)`
  (`formatIvBreakdown` in `sidepanel.js`/`preview.js`). Frees up
  horizontal width so Nature stops getting clipped in a narrow panel.
  No data model change — `ivTotal`/`ivs.*` are unchanged, only display.

### Fixed — Captured table column widths / layout break in Edge (pre-Phase 5)
- The generic even column split left Nat/Qlt too wide and the new IV
  column too narrow, overflowing its fixed width instead of wrapping —
  visible as a broken layout in Edge's narrower side panel. New
  `.captured-table` class gives explicit widths (Pokémon 26% / Nat 13%
  / Qlt 11% / IV 50%) plus `overflow-wrap: anywhere` on the Pokémon/Nat
  cells so an unusually long value wraps in place instead of bleeding
  into the next column. Also fixed the Pokémon/gender-symbol gap, which
  `justify-content: space-between` was stretching across the whole
  (now narrower) column instead of keeping them together.

### Changed — Current view Hunt card relabeling + card removal (pre-Phase 5)
- Hunt card labels translated to English: Elapsed Time / XP/h You /
  XP/h Poké / Dollar / Profit (was Tempo / EXP/h Treinador / EXP/h
  Pokémon / Dólar / Lucro Total).
- Profit card's `<small>` breakdown dropped its `↑ <gold total>` half —
  shows only `↓ <expenses total>` now.
- `.summary-grid` dropped the Attempt Rate card and the old
  `Rare+ Failed` accent card; Seen→Capture's label shortened to
  "Capture". 4-across instead of 5. No domain change — `attemptRate`
  is still computed by `computeSessionMetrics`, just no longer read by
  the UI.
- `preview.js`/`preview.html` updated to match (avoid diff from
  production).

### Changed — Hunt card number formatting/layout (pre-Phase 5)
- **Compact numbers**: any Hunt card value over 5 digits (≥ 100,000)
  now abbreviates its last 3 digits into a "K" suffix instead of
  wrapping/overflowing the narrow card (e.g. `185.673` → `186K`;
  `formatCompactNumber`/`formatCompactPerHour` in `sidepanel.js`/
  `preview.js`). 5-digit-or-under values are unaffected.
- **Dólar card flips its primary metric**: shows the gold **total** up
  front now (was the per-hour rate); `Dólar/h` moves to the `<small>`
  line below instead.
- **Lucro Total's breakdown simplified**: `<small>` now shows just
  `↑ <gold total>` / `↓ <expenses total>` (green/red, `.flow-in`/
  `.flow-out`) instead of labeled `Dólar: X · Gastos: Y · Potions: Z`.
  Potions dropped from this card entirely (still tracked in the domain
  layer, just not shown here).

### Fixed — Phantom "no interaction" encounters in History (pre-Phase 5)
- **Root cause found and fixed**: `domain/encounterTracker.js`'s
  `applyCombatStarted` treated *any* new `combat.started` for an
  already-tracked `wild_monster_id` as "the previous encounter was
  abandoned, start a new one" — finalizing the real encounter as
  `incomplete` (`captureResult: none`) and creating a duplicate that
  then received the actual loot/capture result. Confirmed against a
  real backup: the game sometimes re-announces the *exact same*
  individual (species/level/quality/gender/nature/ivs/qualityMultiplier
  all identical) more than once for one real encounter — likely a
  resend the `seq`-based dedupe can't catch, since it's keyed on
  `socketId|type|seq`, not content. In one real backup this was ~36%
  of all persisted encounters (690/1895), and 99.4% of the resulting
  `incomplete` rows (498/501) were confirmed to be the same individual
  re-announcing, not a genuine new spawn reusing the wild-id slot.
- **Fix**: before finalizing on wild-id reuse, compare the full
  individual fingerprint against the already-tracked draft. If it
  matches, it's the same real encounter — no finalize, no duplicate,
  just an `encounter.update` refreshing `updatedAtMs` so it doesn't go
  stale. A genuinely different individual (the 3 real cases found)
  keeps the exact old behavior (finalize as `incomplete`, start fresh).
- **Scope**: this only prevents *new* duplicates going forward.
  Historical phantom rows already in a user's IndexedDB are untouched
  by this fix — no destructive cleanup was in scope for this change.

### Changed — Current view layout QOL (pre-Phase 5)
- **Hunt card reflowed**: Tempo alone on its own row, the other 4
  metrics (EXP/h Treinador, EXP/h Pokémon, Dólar/h, Lucro Total) in a
  row below (`.hunt-metrics-layout`/`.hunt-metrics-grid` in
  `sidepanel.css`, additive — the old `.hunt-metrics` 5-card grid rule
  is untouched).
- **Fixed**: those 4 cards initially kept `.hunt-metric`'s label-and-value
  side-by-side grid (`1fr auto`), which needs real width — in a
  ~340px panel split 4 ways, a label like "EXP/h Treinador" left no
  room for its own value, which rendered half outside the card
  (`.hunt-metrics-grid .hunt-metric` now stacks label above value
  instead, like `.summary-card` already does; `overflow-wrap: anywhere`
  on the value as a safety net for very large numbers).
- **Seen/Captured/Failed/Seen→Capture/Attempt Rate merged into one
  5-across row**: the old 3-card `.summary-grid` and 2-card `.rate-row`
  below it (Current view only — History's own `.rate-row` detail
  summary is untouched, different element) are now a single
  `.summary-grid` with 5 `.summary-card`s. `Seen`/`Captured`/`Failed`
  are colored (`.count-seen` light blue, `.count-captured` light green,
  `.count-failed` light red — reusing the app's existing gender-male/
  running-status/danger colors instead of introducing new ones).
  `.summary-card strong` shrunk 20px → 16px with `overflow-wrap: anywhere`
  for the tighter 5-column width. Removed the now-dead `.accent-card`
  rule (was Rare+ Failed's, already removed from the markup earlier).
- **"Gastos/h" → "Lucro Total"**: the 4th metric card no longer shows an
  expense rate — it shows `gold - expenses`, a straight total with no
  per-hour component at all, colored green/red by sign. Its `<small>`
  breaks out the raw Dólar/Gastos/Potions totals for context (`gold`/
  `expenses` already existed on `computeSessionMetrics`'s output — no
  domain change needed for this part).
- **Shiny section removed**; its 3 numbers move into By Rarity as a
  `"Qty (ShinyQty)"` gold annotation on Seen/Cap./Fail, per rarity tier —
  `domain/rarityBreakdown.js`'s `computeRarityBreakdown()` now tracks
  `shinySeen`/`shinyCaptured`/`shinyFailed` per tier (still just an
  annotation, always included in the plain count, never additive); the
  old cross-tier `shiny` aggregate stays computed too, just unused by
  the UI now.
- **Captured list**: a shiny capture gets a trailing ` *` on its name
  and a `.captured-row-shiny` gold-tinted row highlight — the only
  per-Pokémon shiny marker there.
- Validated first in `preview.html`/`preview.js` with mock data, then
  replicated to `sidepanel.html`/`sidepanel.js` unchanged in behavior.
  No persisted schema change — `isShiny`, `gold`, `expenses` were
  already there; only the derived/computed shapes grew.

### Added — Captured list (Current view, pre-Phase 5)
- New "Captured" module below By Rarity (and, at the time, Shiny —
  since removed, see "Current view layout QOL" above): one row per
  successfully captured Pokémon this session — Pokémon (with Rarity
  shown as a colored bar on the name, same colors as By Rarity, and
  Gender as a ♂/♀ symbol on the name's other side, instead of two
  separate columns — a QOL trade to fit more IV columns in a narrow
  panel), Nature, Quality (new continuous `qualityMultiplier`), and the
  6 individual IV stats (HP/Atk/Def/SpAtk/SpDef/Spe). No new IndexedDB
  query — reuses the encounters already fetched every poll for the
  Current view's metrics.
- Two new protocol-confirmed fields, `combat.started`-only, same
  non-overwrite policy as `level`/`quality`/`elements`/`gender`/`nature`
  (never taken from `capture.success.creature`):
  - `qualityMultiplier`: a continuous quality score (e.g. `1.02`),
    distinct from the discrete Rarity tier.
  - `ivs`: the 6 individual IV stats, persisted alongside the existing
    `ivTotal` sum instead of being discarded after summing.
- Three filters, narrowing the already-captured-only list: Rarity
  (dropdown, `All (*)` first, populated from distinct values present),
  Quality > (2-decimal input), IV Total > (integer input, using the
  existing `ivTotal` sum).
- `preview.html`/`preview.js` mirror the module with a small
  self-contained mock (5 fictitious captures, varied rarity/gender/
  nature/IVs/qualityMultiplier), filters fully functional.
- Scope: Current view only — History/Compare don't gain these columns
  or this module in this pass.

### Fixed/Added — Seen, Dólar/h and Hunt expenses (pre-Phase 5)
- **Seen is now an exact identity**: `Seen = Captured + Failed`
  (`domain/rarityBreakdown.js`, `domain/groupMetrics.js`). Previously any
  non-orphan encounter counted as "seen" even without a real capture
  attempt (e.g. the player only farmed EXP/gold and moved on) — that no
  longer inflates Seen in Current, History or Compare.
- **Dólar/h now includes a captured Pokémon's sale value**: when
  `encounter.autoSold` is true, its `autoSellValue` is added alongside
  the wild monster's own `loot.received.gold` drop
  (`domain/sessionMetrics.js`, `domain/groupMetrics.js`) — previously
  only the drop counted, even though the sale value was already
  extracted and persisted since Phase 2.
- **New "Gastos/h" metric** (Current + History), Pokébolas + Potions:
  - Pokébolas: `Σ encounter.supplyCost` — a pure new aggregation over
    already-persisted data, no pipeline change.
  - Potions: confirmed via real captures that `loot.received` has a
    second shape — no `wild_monster_id`, just `auto_potion_used` and its
    real `supply_cost` — for when the game auto-drinks a potion mid-fight.
    This is a trainer-wide expense, not tied to one encounter, so it's
    accumulated on the **session** row (`potionsUsed`/`potionsCost`,
    `domain/sessionTiming.js`'s new `recordPotionUsed`,
    `data/sessionsRepository.js`, a new `session.potion_used` effect in
    `domain/encounterTracker.js`/`services/eventPipeline.js`) instead of
    on an encounter. Shown as `Gastos/h` ($ Pokébolas + Potions combined)
    plus a raw "Potions used" count — no invented price table, only what
    the protocol actually reports.
  - Compare gets neither: `potionsCost` is session-scoped and can't be
    split across `group_key`s without inventing data.
- **Bug fix, found during the above**: every auto-potion-used
  `loot.received` (no `wild_monster_id`) used to fall into the "no active
  encounter" path and create a bogus, all-null orphan encounter row —
  present since Phase 2, on a large fraction of real `loot.received`
  traffic. `domain/encounterTracker.js`'s `applyLootReceived` now
  recognizes this shape up front and never creates an encounter for it.

### Added — Phase 1 (Foundation)
- Canonical hunt configuration shape (`domain/config.js`): fixed
  `auto_capture` snapshot with all confirmed fields always present, manual
  EXP rate label, `captureConfigSource`.
- Deterministic config serialization (`domain/canonicalJson.js`) and
  SHA-256 `config_id` hashing (`domain/configHash.js`) — same semantic
  config always hashes to the same id regardless of key order; the config's
  provenance (`captureConfigSource`) never affects the hash.
- Deterministic `group_key` builder (`domain/groupKey.js`).
- IndexedDB `pokepixel_hunt_analyzer` database with versioned migrations
  (`data/migrations.js`, `data/db.js`): `meta`, `sessions`, `configs`,
  `encounters` stores and the initial `encounters` indexes.
- Generic store repository (`data/repository.js`) and an immutable
  `configs` repository (`data/configsRepository.js`) with a
  hash-deduplicated `getOrCreate`.
- Unit and integration test suite (`node --test`, `fake-indexeddb` for
  IndexedDB-backed tests) covering all of the above.

No UI or WebSocket behavior changed. `manifest.json`, `background.js`,
`content.js`, `hook.js` and `sidepanel/**` are untouched — nothing built in
this phase is wired into the running extension yet.

### Added — Phase 2 (Event pipeline)
- Normalized protocol event contracts (`domain/events.js`) for all 6
  inbound event types, proven against a real sanitized capture
  (`tests/fixtures/rhyxus_hunting2.regression.json`).
- Local per-`WebSocket` `socketId` (`hook.js`) and the
  `socketId|eventType|seq` dedupe key.
- Pure session-timing state machine (`domain/sessionTiming.js`): running/
  paused/restart-recovery, persisted via `data/sessionsRepository.js`.
  Restart recovery only runs from a real `chrome.runtime.onStartup`, never
  on a routine MV3 service-worker wake.
- Pure encounter correlation reducer (`domain/encounterTracker.js`):
  wild-id reuse, orphan handling, stale-timeout finalization
  (`STALE_TIMEOUT_MS` = 30 min), all covered by synthetic tests plus the
  fixture replay. Never lets `capture.success.creature.level`/`.quality`
  overwrite the `combat.started` snapshot.
- `data/encountersRepository.js` and `services/eventPipeline.js`, the
  orchestration layer that resolves `config_id`/`group_key` per encounter
  and persists everything to IndexedDB.
- Fixture regression test validating the exact baselines in
  `docs/PROTOCOL_AND_ANALYTICS.md §12` (event counts, failed-by-quality,
  Rare+ = 133) end to end through the real pipeline.
- `hook.js`/`content.js`/`background.js` emit/validate/handle a new
  `protocol.event` message **in addition to** every existing legacy
  message — the v0.3.0 counters and Side Panel behave identically to
  before. `manifest.json`'s service worker is now `"type": "module"` so
  `background.js` can import the modules above.

Real encounters are now persisted to IndexedDB during a live Hunt, but the
Side Panel still reads only the legacy `chrome.storage.session` counters —
migrating the UI to the new data is Phase 3.

### Added — Phase 3 (Current + Config)
- **Automatic Hunt lifecycle** (`domain/huntLifecycle.js`,
  docs/ARCHITECTURE.md §7): a local session starts on the first activity
  and only ends automatically on a confirmed new `serverSessionId` (via
  `combat.started`); an isolated `zoneId` change is tracked as a candidate
  transition without ending the session. Proven against the real fixture —
  its 3 genuine Hunts are correctly split into 3 local sessions.
- `sessions` rows now carry `serverSessionId`/`zoneId`
  (`domain/sessionTiming.js` `adoptServerContext`,
  `data/sessionsRepository.js` `endCurrent`/`forceNewSession`/
  `getCurrentReadOnly`).
- `domain/sessionMetrics.js`: the Current view's full aggregation (status/
  time, Trainer+Pokémon EXP/h, Dollar/h, Seen/Captured/Failed, rates,
  rarity, shiny) computed from `sessions`/`encounters`, not a counter.
- **Side Panel migrated to v1 data**: `sidepanel.js` reads IndexedDB
  directly (own connection, `onversionchange`-safe) and polls every
  second; `New Hunt`/`Pause`/`Resume`/`End Hunt` route through
  `background.js` so every write stays serialized. Added a Pokémon EXP/h
  card (previously missing). `preview.html`/`preview.js` mirror the new
  layout with mock data, still independent of any `chrome.*` API.
- **No Config UI, by design**: the Current view never surfaces
  `auto_capture`/config internals (no field, no ID, no capsule UUID) — the
  full snapshot is still captured from `combat.started` and persisted in
  `configs` (`config_id`/`group_key` unaffected) purely for
  history/comparison, it's just never rendered. There is no manual EXP
  rate input either; `expRateLabel` stays at its documented `"unknown"`
  default (`domain/config.js`).
- **Legacy v0.3.0 pipeline retired**: `hook.js`/`content.js` no longer
  emit/forward `counter.increment`/`hunt.loot`/`hunt.pause`/
  `hunt.activity`; `background.js` no longer keeps a
  `chrome.storage.session` counter. The toolbar badge now derives from v1
  session/encounter data (`refreshBadge`) instead of that counter.

### Added — Phase 4 (History + Compare + Export)
- **Qualitative protocol fields**: `combat.started.data.enemy.elements`/
  `.gender`/`.nature` are now extracted (`hook.js`, `domain/events.js`)
  and carried onto the encounter row (`domain/encounterTracker.js`) —
  same snapshot-at-`combat.started`, never-overwritten-by-
  `capture.success.creature` policy already used for `level`/`quality`.
  `elements` (an array, e.g. `["dragon","flying"]`) is also a Compare
  filter; `gender`/`nature` are display-only. The already-persisted
  `ivTotal` is now shown in History as `n/186`.
- **History tab**: paginated, most-recent-first session list
  (`data/sessionsRepository.js` `getPage`, keyset pagination over a new
  `sessions.startedAtMs` index — migration v2, the project's first real
  schema upgrade) with a from/to date filter reusing the same index.
  Selecting a session shows its metrics plus a per-encounter table
  (species, level, quality, elements, gender, IV total, shiny, result) —
  no technical IDs.
- **Compare tab**: groups encounters by `groupKey` in memory
  (`domain/groupMetrics.js`, Cycle EXP/h per
  `docs/PROTOCOL_AND_ANALYTICS.md §11`), with three `All (*)`-first
  dropdown filters (Pokémon / Pokébola / Elemento) populated from the
  distinct values actually present in the data. Config shown only as an
  8-character `configId` prefix.
- **JSON export**: a "Exportar backup (JSON)" button in History downloads
  `{ formatVersion, appVersion, sessions, configs, encounters }`
  (`domain/export.js`) via `Blob` + `<a download>` — no `downloads`
  permission needed. CSV was dropped from scope during planning.
- **Deletion**: History's detail panel can delete a session and its
  encounters (`sessionsRepository.deleteSession` +
  `encountersRepository.deleteBySessionId`, confirmation prompt); never
  touches `configs`, clears the current-session pointer only if the
  deleted session was current.
- Side Panel navigation is now tab-based (`Current`/`History`/`Compare`);
  only `Current` polls every second, History/Compare load on tab switch
  or after a mutating action. `preview.html`/`preview.js` mirror all
  three tabs with deterministic mock data (including mock
  elements/gender/ivTotal), still independent of any `chrome.*` API.
- `domain/sessionMetrics.js`'s `computeCurrentMetrics` renamed to
  `computeSessionMetrics` (History reuses it for past sessions; identical
  behavior).

### Fixed — Compare tab
- **Pokébola/Elemento filters never populated**: `populateSelect`'s
  optional-override parameters were named `valueOf`/`labelOf`. A plain
  object always inherits `Object.prototype.valueOf`, so the default
  `{ valueOf = (o) => o } = {}` never actually applied when a caller
  didn't pass an override — the borrowed native `valueOf` ran instead
  and threw the moment it was called, aborting `loadCompare()`/
  `renderCompare()` partway through. Renamed to `toValue`/`toLabel`
  (`sidepanel/sidepanel.js`, `sidepanel/preview.js`) to stop shadowing
  any `Object.prototype` member.
- Pokémon names are now capitalized in Compare (table rows and the
  Pokémon filter's options) — a species with no `speciesName` yet
  (unresolved encounter) previously fell back to the raw lowercase
  `species_id` slug.
- Removed the Config column from the Compare table — `groupKey` already
  encodes the config; the raw id added nothing for the user and was
  never meant to be surfaced as its own column (`docs/ARCHITECTURE.md
  §9`).
- Added a "Tema" (By Cycle / By Rarity) selector to Compare: By Cycle is
  the pre-existing species+level+config grouping (minus the Config
  column); By Rarity is new and is the exact same table as Current's own
  By Rarity — all 7 rarity tiers, Seen/Captured/Failed/Rate — computed
  over Compare's filtered encounters instead of one session's. Extracted
  the shared bucketing logic into `domain/rarityBreakdown.js`
  (`computeRarityBreakdown()`), which `domain/sessionMetrics.js` now
  calls internally too, instead of duplicating it.

## [0.3.0]

### Added
- Edge Side Panel.
- Seen/Captured/Failed counters.
- Rarity and shiny counters.
- Hunt timer.
- Trainer EXP/h.
- Dollar/h.
- Session state in `chrome.storage.session`.
