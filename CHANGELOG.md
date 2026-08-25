# Changelog

All notable project changes should be recorded here.
The project follows Semantic Versioning.

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
  English.

## [1.0.0] - 2026-08-10

Initial stable release of the PokePixel Hunt Analyzer.

## [0.3.0]

### Added
- Edge Side Panel.
- Seen/Captured/Failed counters.
- Rarity and shiny counters.
- Hunt timer.
- Trainer EXP/h.
- Dollar/h.
- Session state in `chrome.storage.session`.
