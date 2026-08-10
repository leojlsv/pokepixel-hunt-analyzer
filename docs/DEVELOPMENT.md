# Development

## 1. Security

The extension is passive.

Never persist:

```text
tokens
Authorization headers
cookies
authenticated WebSocket URLs
raw WebSocket frames
```

Keep manifest permissions narrow. Analytics failures must fail closed: the game must keep working.

## 2. Side Panel target

Views: `Current`, `History`, `Compare` (tabs; no separate `Config` view
— removed in Phase 3, config detail does not surface as raw
technical/UUID data anywhere in the UI, see docs/ARCHITECTURE.md §9).

Current should show Hunt status/time, Trainer and Pokémon EXP totals/h, Dollar totals/h, Lucro Total (Dólar - Gastos, no time component, docs/ARCHITECTURE.md §12), Seen/Captured/Failed, rates, rarity (with shiny counts folded in as an annotation, no separate Shiny section, docs/ARCHITECTURE.md §12), and a filterable list of captured Pokémon (Nature/Quality/individual IVs, shiny marked with an asterisk + row highlight, docs/ARCHITECTURE.md §11).

Actions: `New Hunt`, `Pause/Resume`, `End Hunt`.

The legacy `Reset` action and its `chrome.storage.session` counter are
retired once `Current` reads only from the v1 data; the toolbar badge
then derives from the v1 session/encounters, not from the legacy
counter.

History is paginated session history and detail (docs/ARCHITECTURE.md §9).
Compare aggregates either by `species + level + config` ("By Cycle") or
by rarity tier, identical to Current's own By Rarity table ("By Rarity"),
selectable via a "Theme" toggle (docs/ARCHITECTURE.md §9).
Capture config prefers protocol-derived `auto_capture`; EXP rate remains manual/unknown until protocol support is proven.

## 3. Export

JSON only — no CSV (simplified during Fase 4 planning; earlier drafts of
this document sketched CSV column sets, since removed). The backup
contains `formatVersion`, `appVersion`, `sessions`, `configs`,
`encounters` — a direct passthrough of already-fetched rows
(`domain/export.js`). No raw/auth data.

## 4. Preview

Keep the current browser-only preview independent of Chrome extension APIs. Reuse production CSS and deterministic mock data. Do not move it until a UI phase explicitly requires it.

## 5. Minimum tests

Domain/persistence:
- canonical config serialization;
- same semantic config → same hash;
- EXP-rate change → new `config_id`;
- `auto_capture` change → new `config_id`;
- deterministic `group_key`;
- IndexedDB create/read/update/migration;
- running/paused/restart time behavior;
- per-hour formulas and capture rates;
- Seen = Captured + Failed exact identity;
- Dólar/h includes auto-sell value only when auto-sold;
- Gastos/h (Pokébolas supplyCost + session-level potion cost).

Parser/tracker:
- start → loot;
- start → loot → failed;
- start → loot → success;
- auto-sold success;
- no capture event;
- wild-id reuse;
- orphan;
- duplicate event;
- reconnect / seq reset;
- config change between encounters;
- nested success quality;
- captured creature level does not overwrite target level;
- loot.received's auto-potion-used variant never creates an encounter.

Fixture regression validates the event and Rare+ baselines in `docs/PROTOCOL_AND_ANALYTICS.md`.

## 6. Implementation phases

### Phase 1 — Foundation
- domain config/hash/group key;
- IndexedDB + migrations;
- repositories;
- unit/integration tests.

No UI or WebSocket behavior change.

### Phase 2 — Event pipeline
- normalized event contracts;
- local `socketId`;
- session service;
- encounter tracker;
- reuse/orphan/dedupe handling;
- fixture regression.

### Phase 3 — Current + Config
- migrate current Side Panel to new source of truth;
- automatic Hunt lifecycle and manual overrides (docs/ARCHITECTURE.md §7);
- protocol `auto_capture` snapshot;
- manual EXP rate;
- preview update;
- retire the legacy Reset action/counter; toolbar badge moves to v1
  session/encounter data.

### Phase 4 — History + Compare + Export
- history and filters;
- grouped comparison;
- JSON export;
- deletion controls.

### Phase 5 — Hardening + Release
- migration robustness — done, docs/ARCHITECTURE.md §7;
- restart recovery — already covered since Phase 3, docs/ARCHITECTURE.md §7;
- diagnostics — done, docs/ARCHITECTURE.md §13;
- performance — audited, docs/ARCHITECTURE.md §14 (no production
  change needed at realistic scale);
- documentation — done, README.md rewritten for v1, doc consistency
  pass;
- final release checklist — done, all 15 criteria in §8 verified,
  `v1.0.0` released.

## 7. Git

Use SemVer. Preserve the working baseline before migration:

```text
commit baseline
tag v0.3.0
```

Prefer small commits. Do not commit release ZIPs, user exports, temporary logs/debug captures, secrets or machine-local Claude settings. Do not ignore intentional test fixtures.

## 8. v1.0.0 acceptance

- IndexedDB history survives Edge restart;
- browser-closed time is not counted;
- migration path is tested;
- encounter IDs are local UUIDs;
- wild ID is never DB PK;
- config hash and group key are deterministic;
- protocol `auto_capture` is captured when present;
- config changes affect only later encounters;
- wild-id reuse does not merge unrelated encounters;
- session and cycle metrics are clearly separated;
- Current, History and Compare work;
- JSON export and deletion work;
- fixture regression passes;
- no token/raw frame is persisted;
- preview works.

## 9. Diagnostics

Safe counters only:

```text
events_received
events_ignored
parse_errors
db_errors
orphan_events
duplicate_events
active_encounters
db_version
app_version
```

Implemented (Fase 5, step 1 — docs/ARCHITECTURE.md §13):
`data/diagnosticsRepository.js` persists the 6 cumulative counters in
`meta`; `services/eventPipeline.js`'s `getDiagnosticsSnapshot()` adds
the 3 point-in-time ones (`activeEncounters`/`dbVersion`/`appVersion`)
computed live. No UI reads them yet — nothing in the Side Panel
surfaces this data on purpose, for now.

## 10. Post-v1.0.0 roadmap

Not scheduled, not started — captured here so the analysis isn't lost.

### Firefox compatibility

Low-to-moderate effort. `domain/`, `data/`, `services/` and all of
`sidepanel/` are plain JS/DOM/IndexedDB — none of it is Chrome-specific
and none of it should need to change. The work is narrowly scoped to
two files:

- `manifest.json`: add `sidebar_action.default_panel` (pointing at the
  same `sidepanel/sidepanel.html`) alongside the existing `side_panel`
  key — each browser reads the one it understands. Add
  `background.scripts` alongside `background.service_worker` (same
  cross-browser pattern). Add `browser_specific_settings.gecko.id`
  (Firefox requires a stable extension id) and a
  `strict_min_version: "128"` guard — Firefox only added
  `content_scripts[].world: "MAIN"` support in version 128 (Jul 2024),
  and `hook.js`'s WebSocket interception hard-depends on it.
- `background.js`: `chrome.sidePanel` has no Firefox equivalent
  (`sidebarAction` is a different, incompatible API/lifecycle) — needs
  a small feature-detect branch (`chrome.sidePanel` present → current
  code path; else → `browser.action.onClicked` +
  `browser.sidebarAction.toggle()`). Isolated, doesn't touch the event
  pipeline or session logic.

Needs real manual testing in Firefox (`about:debugging` → load
temporary add-on) — no automated harness covers `manifest.json`/
`background.js` today, same limitation that already exists for Chrome/
Edge. Publishing to addons.mozilla.org (vs. just loading unpacked) adds
Mozilla's separate signing/review process, outside of code effort.

Zen Browser would follow for free once this lands — it's a Firefox
fork (Gecko engine), same `sidebarAction` surface.

### Brave

Currently blocked on Brave's own side, not ours: `chrome.sidePanel`
has open, unresolved bugs in Brave (panel opens then disappears after
~1s; their sidebar has no UI yet to activate side panel extensions) —
tracked upstream at
[brave/brave-browser#32132](https://github.com/brave/brave-browser/issues/32132)
and
[#31334](https://github.com/brave/brave-browser/issues/31334), tagged
low priority (P3) on their roadmap. Nothing to build here — revisit if
Brave fixes it.

### Opera / Vivaldi

Chromium-based, likely already work — never actually tested. Low
effort if/when it's worth confirming (just needs someone to load the
unpacked extension and check).
