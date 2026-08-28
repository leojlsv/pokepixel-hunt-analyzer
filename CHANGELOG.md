# Changelog

All notable project changes should be recorded here.
The project follows Semantic Versioning.

## [1.12.0] - 2026-08-28

### Customizable Closed HUD
- Replaced the fixed minimized summary with a persistent 2x2 Closed HUD containing four configurable layout units, presets (`Default`, `Leveling`, `Economy`, `Capture`) and a Custom mode controlled from the new `HUD` header button.
- Added the final non-redundant widget catalog: Seen, Seen/h, Hunt Time, Captured, Failed, Capture Rate, Rarity Tracker, Shiny Tracker, Rare+ Attempts/Captured/Failed, Highest IV, Trainer XP/h, Pokémon XP/h, Dollar, Dollar/h, Profit, Profit/h, Expenses, Total Balls Used, Ball Tracker, Ball Success/Failed/Capture Rate/Cost and Potion Tracker.
- Seen compacts when necessary while Captured remains exact; XP/economy values keep useful compact precision and Profit preserves positive/negative semantic tone.
- Closed HUD configuration persists locally and reload hydration now hides the launcher until the first real Current state is rendered, preventing the legacy/zero-value flash on F5.

### Capture and supply trackers
- Consolidated Shiny into one fixed `★ Seen / Captured` tracker; Seen is compact, Captured is exact, and both the star and Captured use the same gold accent. Legacy separate Shiny settings normalize automatically.
- Reworked Rarity Tracker so `Show Failed` OFF renders Captured only and ON renders `Failed / Captured`; Seen was removed from this tracker and Captured keeps visual priority. Density adapts for 5 and 6–7 selected rarities.
- Added Rare+ Attempts/Captured/Failed using the fixed set `Rare + Epic + Legendary + Mythical`.
- Added Highest IV as the maximum non-null `ivTotal` observed in the Hunt.
- Added per-Ball Success, Failed, Capture Rate and Cost from persisted current-Hunt encounters grouped by `capsuleItemId`.
- Ball Tracker now combines authoritative current stock with `↓ used`; Potion Tracker follows the same presentation.
- Per-Potion usage is inferred from decreases between authoritative Inventory snapshots, ignores refills/purchases, persists across F5 for the same local Hunt and resets on New Hunt.
- Supply symbols (`✓`, `✕`, `$`, `↓`) are visually secondary and separated from their numeric values.

### Sound Alerts UX
- Added a persistent global Mute/Unmute speaker control to Sound Alerts without changing or erasing any individual Sound 1 / Sound 2 / Custom selections.

### Documentation and release hygiene
- Added `docs/CLOSED_HUD.md` as the normative Closed HUD catalog/formula/persistence reference.
- Updated README, Architecture and Development documentation for the v1.12.0 runtime, Inventory integration, local presentation state and expanded manual smoke checklist.
- No IndexedDB migration, protocol contract change, dependency change, new Tampermonkey grant or `@connect` permission.
- Complete production-domain manual smoke approved before release; automated CI test/build validation passed on the approved feature package.

## [1.11.1] - 2026-08-27

### Profit accounting hotfix
- Dollar and Profit now include `loot.received.loot_sell_value`, which was already normalized and persisted but previously omitted from financial aggregation.
- Revenue semantics are now consistent across Current, History and grouped Pokémon analytics: kill Gold + loot sell value + realized Pokémon auto-sell.
- Existing capsule and potion expense accounting is unchanged.

### Validation
- Added unit coverage for session/group revenue including loot sell value.
- Added end-to-end persistence/accounting coverage proving `gold + loot_sell_value + auto_sell_value - supply_cost`.
- Manual in-game validation approved before release.
- No IndexedDB migration, protocol change, dependency change or permission change.

## [1.11.0] - 2026-08-26

### Native Tampermonkey updates
- Production builds now declare stable `@updateURL` and `@downloadURL` metadata so update discovery and installation are controlled by Tampermonkey rather than by Analyzer runtime code.
- Production builds now generate a lightweight `pokepixel-hunt-analyzer.meta.js` alongside the full `.user.js`; DEV builds remain isolated and publish no update metadata.
- Added automated checks that the package version, production metadata, userscript header and canonical update URLs remain consistent.
- Added a guarded `publish/vX.Y.Z` release workflow that only publishes from the current merged `main` commit and uploads both stable update assets.
- Added `docs/TAMPERMONKEY_UPDATES.md` as the normative release/update contract, including bootstrap, invariants, smoke testing, hotfixes and post-release verification.

### Bootstrap note
- v1.11.0 is the first release carrying the native update channel. Users on v1.10.0 or older must install v1.11.0 manually once; subsequent releases can be detected by Tampermonkey.
- No Analyzer UI update notification, GitHub runtime polling, IndexedDB migration, new dependency, grant or `@connect` permission was added.

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
- Full EN-US UI translation, History detail refinements, security hardening and the earlier Phase 1–5 implementation history are preserved in the repository history below this release line.

## [1.0.0] - 2026-08-10

All 15 acceptance criteria in `docs/DEVELOPMENT.md §8` verified passing (Phase 5 final release checklist). This release consolidated the IndexedDB foundation, event pipeline, Current/History/Compare surfaces, diagnostics, robustness and documentation work accumulated from the original extension architecture.

## [0.3.0]

### Added
- Edge Side Panel.
- Seen/Captured/Failed counters.
- Rarity and shiny counters.
- Hunt timer.
- Trainer EXP/h.
- Dollar/h.
- Session state in `chrome.storage.session`.
