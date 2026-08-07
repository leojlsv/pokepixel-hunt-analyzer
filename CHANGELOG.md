# Changelog

All notable project changes should be recorded here.
The project follows Semantic Versioning.

## [Unreleased]

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

### Planned
- Migrate the Side Panel to the Phase 1/2 data (Current + Config), Phase 3.
- History, Compare and CSV/JSON export (Phase 4).

## [0.3.0]

### Added
- Edge Side Panel.
- Seen/Captured/Failed counters.
- Rarity and shiny counters.
- Hunt timer.
- Trainer EXP/h.
- Dollar/h.
- Session state in `chrome.storage.session`.
