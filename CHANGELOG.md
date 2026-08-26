# Changelog

All notable project changes should be recorded here.
The project follows Semantic Versioning.

## [1.10.0] - 2026-08-26

### Current capture analytics
- Captured and Failed Rarity filters now support checkbox multi-select instead of a single rarity at a time; `All (*)` selects every known rarity and preserves the explicit unfiltered state.
- Current > Failed now exposes the protocol-reported capture `Chance` directly in the table alongside `Pokémon | IV | Pokéball | Fled at`.
- `Fled at` now disambiguates Hunts that cross local calendar days: same-day rows remain `HH:mm:ss`, while later dates render as `+1d HH:mm:ss`, `+2d HH:mm:ss`, and so on; the full local timestamp remains available in the hover title.
- Hunt start time is included in Current session metrics so day-offset rendering stays deterministic without changing persisted encounter data.
- Profit behavior remains unchanged and verified: realized capture auto-sell proceeds are already included in Dollar before Expenses are subtracted.

### Validation
- Added unit coverage for multi-rarity filtering, explicit `All (*)`, empty selections and cross-day `Fled at` formatting.
- Manual in-game validation approved before merge.
- No IndexedDB migration, dependency change or new external permission is required.

## [1.9.1] - 2026-08-26

### Hunt lifecycle UX
- A confirmed encounter in a different `zoneId` now ends the previous local Hunt and starts a new one, even when the server keeps the same `serverSessionId`.
- The first real encounter in the new zone becomes the boundary, avoiding resets from merely traversing between areas.
- Same server session + same zone continues the current Hunt unchanged.
- Manual Pause and End Hunt locks keep priority and still block automatic Hunt boundaries.

### Validation
- Added unit coverage for zone change => `new_hunt`.
- Added integration coverage proving encounters are persisted into separate sessions across a zone change.
- Manual in-game validation approved before release.

## [1.9.0] - 2026-08-25

### HuntSim protocol compatibility
- Added a protocol adapter between the passive WebSocket observer and the existing canonical event pipeline.
- Added HuntSim full-frame entity decoding and kill-sequence correlation across `hunt.frame`, `hunt.capture_queue`, `hunt.events`, terminal `capture.*` events and aggregated `loot.received.per_kill[]` rewards.
- Added synthetic HuntSim correlation ids while preserving legacy `wild_monster_id` behavior and the existing IndexedDB/domain model.
- Added support for HuntSim terminal-before-loot ordering so late rewards patch the same persisted encounter instead of creating duplicates.
- Explicitly ignores duplicate HuntSim reward/capture projections (`hunt.kill_reward`, `hunt.rewards`, capture projections inside `hunt.events`) to prevent double counting.
- Legacy PROD event flow remains supported unchanged.

### Capture data correctness
- Successful HuntSim captures now preserve authoritative `creature` metadata: Rarity, Shiny, IV breakdown/total, Gender, Nature, Elements, Quality Multiplier and Captured By.
- Unmatched `capture.success` events retain terminal creature metadata instead of persisting mostly-empty orphan rows.
- `capture.success.creature.level` remains intentionally excluded as target level because the captured creature can be rebased independently from the hunted target.
- Failed HuntSim captures preserve the fields actually exposed by the protocol: Rarity, Shiny, IV Total, Capsule, Chance and target Level; unavailable Gender/Nature/full IV breakdown/Elements/Quality Multiplier remain null rather than inferred.
- Aggregated HuntSim loot is split into one canonical reward event per kill while preserving global XP/Gold totals.
- Added nested `creature.captured_by_name` fallback used by Capture Ticket eligibility.

### Current / History UI
- Simplified Current > Failed to `Pokémon | IV | Pokéball | Fled at` with values visible directly in the table; removed the Failed Quality filter and row detail expansion.
- Reordered Captured IV breakdown to `HP · Atk · sAtk · Def · sDef · SpD` and exposed that order in the column header for visual validation.
- Replaced History Attempts/Notables `Qlt` with `Ball`, which is authoritative for both successful and failed attempts under HuntSim.
- Collapsing Hunt XP metrics now keeps the current Pokémon label and Hunt status visible.

### Capture Ticket / Catch Gallery
- Fixed `Generate` preview mounting so the dialog owns the viewport/z-index and opens reliably from Catch Gallery.
- Standardized Pokémon sprite rendering on a 192×192 useful area: the complete source PNG canvas is fitted as the `1x` baseline, centered/clipped to the area, rendered with Canvas smoothing disabled and previewed with pixelated image rendering.
- Preserved `Generate`, PNG download and `Copy` behavior with the existing metadata/fingerprint pipeline.

### Build / release hygiene
- Bumped application version to `1.9.0` in `package.json` and `package-lock.json`.
- Restored the default userscript build to the production identity/domain and preserved the historical production namespace for Tampermonkey update continuity.
- Added `npm run build:userscript:dev` as an explicit DEV-only build targeting `dev.pokepixel.nietore.com`, so future protocol smoke tests no longer require mutating release metadata.
- Updated README and technical documentation for the dual legacy/HuntSim protocol boundary and the v1.9 UI/runtime behavior.

### Validation
- 255 automated tests passing with zero failures.
- Dependency audit reports 0 vulnerabilities.
- Legacy 4000+ fixture replay preserves 4,128 persisted encounter rows.
- HuntSim unit/integration coverage validates correlation, successful/failed terminal events, late loot and unmatched-success persistence.
- Manual DEV smoke validated Hunt metrics, rarity counts, capture details, Catch Gallery Generate/Copy, Capture Ticket pixel rendering and the Current/History UI refinements.

## [1.8.0] - 2026-08-24

### History
- Replaced the retired Compare surface with `Hunts | Pokémon | Attempts`.
- Added session-first History loading, filters, Hunt drill-downs and notable encounter views.
- Added destructive Hunt deletion from expanded History rows with confirmation.
- Current Hunt deletion is blocked while Running/Paused; `End Hunt` is required before deleting it.

### Sound Alerts
- Added Epic / Legendary / Mythical / Shiny alerts for both Captured and Fled outcomes.
- Added built-in Sound 1 / Sound 2 selection per event.
- Added Custom Audio import per event, stored locally in a separate IndexedDB asset database.
- Shiny alert priority is preserved when both Shiny and rarity alerts are enabled.
- Only the ACTIVE analyzer tab plays alerts.

### Capture Ticket / Catch Gallery — BETA
- Added Capture Tickets for eligible new Legendary, Mythical and Shiny captures.
- Added `Misc > Catch Gallery` with Pokémon/rarity filters, Captured/Quality/IV sorting and five-row pagination.
- Added `Generate` preview/download and `Copy` image clipboard actions.
- Added themed Legend / Mythic / Shiny ticket artwork, Silkscreen rendering and PokémonDB Black/White sprites.
- Added non-visible PNG attribution/fingerprint metadata.
- Added a visible `BETA` marker while broader player/browser behavior is still being validated.

### Runtime / persistence
- Added IndexedDB schema v3 with sparse `captureTicketAtMs` index for bounded newest-first Gallery reads.
- Managed IndexedDB connections now close on `versionchange` so upgrades are not unnecessarily blocked by older tabs.
- Added bounded remote image LRU cache, in-flight request dedupe, request pacing and timeout.
- Added `GM_xmlhttpRequest` / `@connect img.pokemondb.net` for remote Capture Ticket sprite loading.
- Added explicit `unsafeWindow` page-window resolution so privileged Tampermonkey grants do not break the WebSocket observer.
- Removed retired `userscript/compare-view.js`.

### Documentation / release hygiene
- Bumped application version to `1.8.0` in `package.json` and `package-lock.json`.
- Updated userscript description for Current / History / local tools.
- Reworked README for the v1.8 product surface and clarified that analytics data stays local while Capture Ticket may fetch public PokémonDB/Google Fonts assets.
- Updated Architecture, Development, Contributing and Capture Ticket documentation.
- Temporary Catch Gallery DEV harness remains outside the release branch.

### Validation
- 248 automated tests passing with zero failures.
- Dependency audit reports 0 vulnerabilities.
- Full 4000+ event fixture replay preserves 4,128 persisted encounter rows.
- Production userscript v1.8.0 build validated by CI.
- Final live smoke approved on the exact release build: WebSocket hook, live metrics, ACTIVE/STANDBY, F5 persistence, Sound Alerts, Custom Audio, Capture Ticket Generate/Copy, Current Hunt DELETE guard, End Hunt unlock and deletion persistence.

## [1.7.0] - 2026-08-22

### Performance — Long Hunt stability
- Removed the full Current reload after every WebSocket event; Current now renders on a single 1-second cadence.
- Cached the current session encounter snapshot and only re-read IndexedDB when relevant encounter data changes.
- Split expensive encounter aggregation from dynamic timer/per-hour refreshes so thousands of encounters are not rescanned every second.
- Prevented overlapping Current loads on large sessions and retained periodic reconciliation for STANDBY tabs.
- Preserved complete `socketId|type|seq` dedupe semantics while moving production dedupe to one append-only registry, avoiding repeated copies of the growing Set.
- Captured/Failed now keep only a progressively loaded prefix in the DOM while filters and sorting still operate on the complete dataset.

### Added — Encounter details and filters
- Captured/Failed rows can now be expanded and collapsed by clicking the Pokémon row.
- Detail rows display `Captured at` (`YYYY-MM-DD HH:mm:ss`) and the Capsule used.
- Captured details additionally display the capture Chance as a percentage.
- Added Shiny filter with `All / Yes / No` options.
- Added sortable Pokémon (capture/fail timestamp), Qlt and IV columns.
- Sorting preserves the current table scroll position instead of jumping back to the top.
- Rarity, Shiny, Quality and IV filters are kept side-by-side in one row.

### Changed — HUD and metrics
- Compact HUD now has a 220px minimum width and grows dynamically as values increase.
- Profit is displayed in green when positive and red when negative.

### Validation
- 197 automated tests passing with zero failures.
- Full 4000+ event fixture replay preserved the expected 4,128 persisted encounter rows.
- Production userscript v1.7.0 build validated by CI.
- Initial live PokePixel smoke test approved; final visual smoke test pending for the last UI refinements.

## [1.6.4] - 2026-08-19

### Changed — Launcher badge toggle
- Clicking the compact `PX` launcher badge now toggles the Analyzer panel instead of only opening it.
- When the panel is closed, clicking the badge opens it; when already open, clicking the badge closes it.
- Dragging the launcher still only repositions it and does not toggle the panel.
- The existing persisted open/closed state remains unchanged.

### Validation
- Automated test suite and production userscript build validated by CI.

## [1.6.3] - 2026-08-19

### Changed — Shiny visibility and encounter list density
- `By Rarity` in Current and Compare now renders counts as `X (Y)` when Shiny entries exist, keeping the total count normal and highlighting only the Shiny sub-count in gold.
- Shiny rows in Captured and Failed now receive a subtle gold-tinted background while preserving the existing rarity text colors and Shiny `*` marker.
- Captured and Failed now show up to 5 encounter rows before switching to vertical scrolling; filtering still applies to the full underlying list.

### Validation
- 190 automated tests passing with zero failures.
- Production userscript v1.6.3 build validated by CI.
- Live PokePixel smoke test approved for Shiny counters, Shiny row highlighting, 5-row limits, scrolling and encounter filters.

## [1.6.2] - 2026-08-19

### Changed — Project hygiene and runtime boundaries
- Refactored the userscript runtime into responsibility-based modules for WebSocket observation, ACTIVE/STANDBY tab leadership and static UI markup.
- Reduced responsibilities in `userscript/main.js` and `userscript/ui.js` without changing analytics formulas, IndexedDB contracts or user-facing behavior.
- Removed obsolete Manifest V3 / Side Panel bootstrap, scaffold, preview and placeholder files that no longer belonged to the supported Tampermonkey runtime.
- Rewrote architecture/development documentation to match the production runtime and added `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig`, `.nvmrc`, PR/Issue templates and GitHub Actions CI.
- Standardized development and CI on Node.js 24 LTS and current `actions/checkout` / `actions/setup-node` releases.
- CI now validates pull requests and `main` without duplicating branch runs.

### Added
- Unit coverage for passive WebSocket payload decoding.
- Unit coverage for multi-tab leadership acquisition, renewal, takeover and release.

### Validation
- 190 automated tests passing with zero failures.
- Production userscript v1.6.2 build validated by CI.
- Live PokePixel smoke test approved: game connection, Current, Hunt actions, Captured/Failed filters, HUD, drag/resize/scroll/alpha, Compare, reload persistence and two-tab ACTIVE/STANDBY behavior.

## [1.6.0] - 2026-08-19

### Changed — Tampermonkey runtime consolidation
- Tampermonkey userscript is now the sole production runtime.
- Removed the retired Manifest V3 / Side Panel implementation:
  `manifest.json`, `background.js`, `content.js`, `hook.js` and `sidepanel/**`.
- Consolidated the incremental version-patch chain into responsibility-based modules:
  `main.js`, `ui.js`, `current-view.js`, `compare-view.js`, `ui-utils.js` and `styles.js`.
- Removed redundant MutationObservers, duplicate IndexedDB polling and duplicated event normalization.
- Current, Captured, Failed, HUD and Compare now render directly from the state already available to the runtime.
- Compare sorting now operates on data before rendering instead of repeatedly rearranging observed DOM.
- Application version now has a single source of truth: `package.json` injected at build time.
- Removed the retired JSON Export implementation and its obsolete unit test.
- Added `npm run validate` to run tests and build together.
- Updated `CLAUDE.md` to reflect the Tampermonkey-only architecture and clean-code constraints.

### Validation
- 183 automated tests passing.
- v1.6.0 userscript build validated.
- Live PokePixel smoke test approved with no observed regressions.

### Fixed — Captured list froze after leaving and returning to the Hunt (e.g. a city trip)
- `hook.js`'s per-connection `socketId` counter (`nextSocketId`) started
  at `1` on every content-script injection. A full page navigation (e.g.
  Hunt → city → Hunt) re-runs `hook.js` from scratch, resetting that
  counter back to `1`, while the background service worker's dedupe state
  (`domain/encounterTracker.js`'s `seenKeys`, keyed on
  `socketId|type|seq`, docs/PROTOCOL_AND_ANALYTICS.md §8) survives that
  same reload as long as the service worker stays alive. Combined with the
  protocol's own `seq` also restarting after a reconnection (§8 again),
  the first post-reload `combat.started`/`loot.received`/
  `capture.success` events could reuse the exact `socketId|type|seq` key
  already seen earlier in the same local Hunt session — silently dropped
  as duplicates (`duplicateEvents` diagnostic incremented, no UI to see
  it). The session status still resumed to "Running" normally (an
  unrelated signal like `hunt.analyzer_reset` doesn't collide), which is
  what made the Captured list's silent freeze confusing — everything
  *looked* resumed. Fixed by seeding `nextSocketId` from `Date.now()`
  instead of `1`, making each page load's socketId range effectively
  unique across reloads.

### Changed — Full EN-US translation of the on-screen UI
- Every user-facing PT-BR string in `manifest.json`, `sidepanel.html`,
  `sidepanel.js`, `preview.html`, and `preview.js` translated to
  EN-US: manifest `description`/`action.default_title`; `lang="pt-BR"`
  → `lang="en"`; `aria-label`s; filter labels (`De/Até` → `From/To`,
  `Tema` → `Theme`, `Pokébola` → `Capsule`, `Elemento` → `Element`);
  buttons (`Filtrar`/`Limpar`/`Carregar mais`/`Voltar`/`Apagar esta
  sessão` → `Filter`/`Clear`/`Load more`/`Back`/`Delete this session`);
  empty states and warnings; the delete-session `confirm()` dialog; the
  History detail summary's per-metric labels (renamed to match
  Current's own naming: `XP/h You`/`XP/h Poké`/`Dollar/h`/
  `Expenses/h`); Compare's theme subtitle (`Agrupado por...` →
  `Grouped by...`); the `ex:` input placeholders → `e.g.`; the preview
  banner/footer/alert.
- Verified the IndexedDB model itself needed no changes — field names,
  enum values, and everything actually persisted were already English
  (confirmed by inspection before starting this pass).
- Any table header in the UI now uses an abbreviation where one made
  sense, consistent with the style already established elsewhere
  (`Cap.`/`Nat`/`Qlt`): History's list table `Início`/`Duração` →
  `Start`/`Dur.`; the History detail and Compare tables' `Nv` (a PT-BR
  abbreviation for "Nível") → `Lvl`; History detail's `Gender`/`Result`
  → `Gen.`/`Res.`, and its `Quality` column → `Qlt` (matching
  Current's Captured list, same underlying field). Row-identifying
  columns (`Pokémon`, `Rarity`) are left unabbreviated on purpose.
- `docs/ARCHITECTURE.md`/`docs/DEVELOPMENT.md`: updated the handful of
  spots that quoted exact former UI label text (`"Tema"` toggle, the
  `Pokébola`/`Elemento` filters, the History detail column list) so
  they match what's now on screen. Doc/formula concept names like
  "Dólar/h"/"Gastos/h" used as analysis jargon elsewhere in the docs
  were deliberately left as-is — out of scope for this pass (UI +
  IndexedDB model only, not prose).

### Changed — History detail table columns
- `Espécie` → `Pokémon`, `Gênero` → `Gender`, `Resultado` → `Result`.
- Removed the `Elementos` column (species elements aren't shown in
  History anymore — they're still Compare's filter, untouched).
- The old `Quality` column (which actually showed the discrete rarity
  tier, e.g. `epic`) renamed to `Rarity`; a new `Quality` column added
  right after it, showing `qualityMultiplier` (the continuous score,
  e.g. `1.48`) via the existing `formatQualityMultiplier` — same field
  already shown in Current's Captured list, now also here.
- `preview.js`'s `mockEncounter()`/`MOCK_HISTORY_SESSIONS` gained
  `qualityMultiplier` values so the preview's History detail matches
  what production now shows.

### Changed — Captured list IV column simplified further
- Dropped the summed `ivTotal` prefix from the Captured table's IV
  cell — was `186 (31-31-31-31-31-31)`, now just `31-31-31-31-31-31`.
  Header simplified to match: `IV (HP-ATK-DEF-SATK-SDEF-SPE)` →
  `HP-ATK-DEF-SATK-SDEF-SPE`. Frees up more width; the "IV Total >"
  filter is unaffected (still reads `encounter.ivTotal` directly, only
  the display changed).

### Docs — post-v1.0.0 roadmap
- `docs/DEVELOPMENT.md §10`: captured the browser-compatibility
  analysis (Firefox — low-to-moderate effort, concretely scoped to
  `manifest.json` + a small `background.js` branch; Brave — blocked on
  their own unresolved `chrome.sidePanel` bugs, not ours to fix; Opera/
  Vivaldi — likely fine, untested). Not scheduled, not started — just
  written down so the analysis isn't lost.

### Security — least privilege + session message sender validation
- `manifest.json`: removed the unused `storage` permission — nothing in
  the codebase calls `chrome.storage.*` (the extension persists
  everything in IndexedDB, which needs no permission grant); it was a
  leftover from the retired v0.3.0 `chrome.storage.session` model.
- `background.js`: `session.new`/`pause`/`resume`/`end` now validate
  the sender before acting, same as `protocol.event` already did.
  New `isOwnExtensionSender` checks `sender.id` and that `sender.url`'s
  scheme is `chrome-extension:` (an extension page, not a content
  script) — not `sender.tab`'s presence, since a Side Panel sender can
  carry a `tab` too. Not currently reachable by an external page (no
  `externally_connectable` declared), but fails closed instead of
  assuming that stays true forever. See `docs/ARCHITECTURE.md §3`.

## [1.0.0] - 2026-08-10

All 15 acceptance criteria in `docs/DEVELOPMENT.md §8` verified passing
(Phase 5, step 5 — final release checklist). This release folds in
everything accumulated below since the `v0.3.0` baseline: Phases 1-4
(IndexedDB foundation, event pipeline, Current/Config, History/Compare/
Export) and Phase 5 (diagnostics counters, IndexedDB connection
robustness, a performance audit with no code changes needed, and this
documentation pass).

### Docs — README rewrite + consistency pass (Phase 5, step 4)
- `README.md` fully rewritten — it still described the retired v0.3.0
  `chrome.storage.session` model with no mention of Current/History/
  Compare, IndexedDB, or the session/encounter model. Now covers what
  the extension actually does, privacy/security guarantees, install
  steps, `npm test`, the preview workflow, and pointers to the other
  docs.
- `docs/ARCHITECTURE.md`: fixed a stale cross-reference (Compare's By
  Rarity pointed at §2, the data-flow diagram, instead of §12 where
  that table's current behavior is actually documented); added a
  `### meta` subsection under §4 (the store existed and was used, but
  had no schema documentation of its own like `sessions`/`configs`/
  `encounters` do).

### Performance audit — no production changes needed (Phase 5, step 3)
- Benchmarked Current's 1s poll, Compare's full-store scan, and History's
  page load against the largest realistic scale available (the 4324-event
  regression fixture — 4128 persisted encounters, largest single session
  2319 of them). Worst case: ~17-23ms/poll for Current (~2% of its 1s
  budget), ~20-30ms for Compare, ~55ms for a History page. No code change
  needed — existing indexes (`sessionId`/`startedAtMs`) are already used
  on the right paths. See `docs/ARCHITECTURE.md §14`.
- The one real finding was in the test suite, not the app:
  `tests/integration/fixtureRegression.test.js` had 2 tests each
  independently replaying the same ~4300-event fixture (~25s each,
  ~50s combined) against `fake-indexeddb`. Now memoized to replay once
  and share the result — same two independent pass/fail results, `npm
  test` total dropped from ~50-75s to ~28s.

### Fixed — IndexedDB connection robustness (Phase 5, step 2)
- `background.js`: fixed a real bug where a transient `openDatabase()`
  failure (e.g. `onblocked` briefly during an extension update) was
  cached forever as broken — `dbPromise`/`eventPipelinePromise` are now
  reset to `null` on rejection so the next event retries instead of
  failing instantly for the rest of that service worker's lifetime.
- `sidepanel.js`/`preview.js`/`.html`: new `#db-warning` element
  (reuses the existing `.warning` style) shown whenever the Side
  Panel's own IndexedDB connection is lost — either `openDb()` fails
  outright or `db.onversionchange` fires later (extension updated
  while the panel was open). The 1s poll now stops cleanly
  (`stopPolling()`) instead of silently retrying against a dead
  connection forever.
- `tests/integration/db.test.js`: 3 new tests closing real coverage
  gaps — `onblocked` is now exercised, a migration throwing mid-upgrade
  is confirmed to abort atomically (no partial index left behind), and
  opening at a lower version than what's persisted is confirmed to
  reject cleanly.

### Added — Diagnostics counters (Phase 5, step 1)
- New `data/diagnosticsRepository.js`: persists the 6 cumulative safe
  counters from `docs/DEVELOPMENT.md §9` (`eventsReceived`,
  `eventsIgnored`, `parseErrors`, `dbErrors`, `orphanEvents`,
  `duplicateEvents`) in the existing `meta` IndexedDB store — no new
  object store, no migration.
- `services/eventPipeline.js` increments these from existing signals
  (unknown event type vs. malformed known-type payload, the exact
  `socketId|type|seq` dedupe, orphan encounter creation) and exposes
  `getDiagnosticsSnapshot()`, which adds 3 live point-in-time values
  (`activeEncounters`, `dbVersion`, `appVersion`) computed on demand
  instead of persisted.
- `background.js` records `dbErrors` from its existing per-message
  `.catch()` blocks and injects `appVersion` from the manifest.
- No UI change — nothing surfaces these yet on purpose (decided for
  this step); see `docs/ARCHITECTURE.md §13`.

### Changed — Captured list IV column merge (pre-Phase 5)
- The 6 separate IV columns (HP/Atk/Def/SpAtk/SpDef/Spe) in the Current
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
