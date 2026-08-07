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

### Planned
- Normalized session and encounter history (event pipeline, Phase 2).
- Analytics by species, level and configuration.
- History, Compare and CSV/JSON export.

## [0.3.0]

### Added
- Edge Side Panel.
- Seen/Captured/Failed counters.
- Rarity and shiny counters.
- Hunt timer.
- Trainer EXP/h.
- Dollar/h.
- Session state in `chrome.storage.session`.
