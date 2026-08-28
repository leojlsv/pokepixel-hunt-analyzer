# Development

## 1. Requirements

- Node.js 24+
- npm
- Tampermonkey for live smoke testing

Install exactly the dependencies recorded in the lockfile:

```bash
npm ci
```

Validate the project:

```bash
npm run audit:deps
npm run validate
```

`validate` runs the complete Node test suite, builds the production userscript + metadata manifest and verifies their update contract.

## 2. Source layout

```text
userscript/   browser runtime and UI
domain/       business rules and pure calculations
data/         IndexedDB and repositories
services/     application/event coordination
tests/        unit, integration and sanitized fixtures
scripts/      build/development utilities
docs/         architecture and product/runtime decisions
```

See `docs/ARCHITECTURE.md` for detailed responsibilities and `docs/CLOSED_HUD.md` for the compact HUD contract.

## 3. Development workflow

Start from an up-to-date `main`:

```bash
git switch main
git pull --ff-only
git switch -c feat/my-change
```

Recommended branch prefixes:

```text
feat/
fix/
refactor/
docs/
dev/
release/
```

Keep changes focused. A refactor should not quietly change formulas or product behavior.

Before opening or finalizing a PR:

```bash
npm ci
npm run audit:deps
npm run validate
```

For runtime/UI changes, also perform the manual smoke test in section 8 on the production-domain build.

## 4. Code rules

### Boundaries

- Runtime/browser integration belongs in `userscript/`.
- Generation-specific protocol reconciliation belongs in `userscript/protocol-adapter.js`; canonical event normalization belongs in `domain/events.js`.
- Core analytics formulas belong in domain modules.
- Presentation-only combinations may be derived from state already loaded by the caller, but must not create a second analytics persistence model.
- IndexedDB access belongs in `data/` repositories.
- Cross-module application coordination belongs in `services/`.
- Closed HUD and Inventory presentation behavior belongs in `userscript/closed-hud*.js` and `userscript/inventory-state.js`.

Avoid bypassing these boundaries for convenience.

### Tampermonkey runtime boundary

The production userscript currently uses:

```text
@sandbox raw
@grant GM_xmlhttpRequest
@grant unsafeWindow
@connect img.pokemondb.net
```

Production builds also declare Tampermonkey-native update metadata:

```text
@updateURL   .../releases/latest/download/pokepixel-hunt-analyzer.meta.js
@downloadURL .../releases/latest/download/pokepixel-hunt-analyzer.user.js
```

These URLs are Tampermonkey metadata, not Analyzer runtime requests. They do not require a new `@grant` or `@connect` entry. DEV builds intentionally omit both update directives so a development userscript can never replace or join the production update channel.

Do not assume the userscript `window` is the page JavaScript global when privileged grants are present. Integrations with page-owned objects such as `WebSocket` and the Inventory API must resolve the page window explicitly.

Adding or removing `@grant`, `@sandbox` or `@connect` is a runtime/security change and requires:

1. explicit justification;
2. automated coverage where possible;
3. a live smoke test before merge.

### Side effects

Keep side effects at runtime and persistence boundaries. Prefer pure functions for calculations, normalization and grouping.

### Duplication

Do not duplicate:

- protocol parsing;
- metric formulas;
- IndexedDB reads for data already loaded by the caller;
- render pipelines;
- application version constants.

`package.json` is the authoritative application version. `package-lock.json` must be synchronized before release. Production `.user.js` and `.meta.js` metadata are generated from that same version by `scripts/build-userscript.mjs`.

### File organization

Prefer modules named by responsibility. Do not create version-named patch files such as:

```text
fix-v162.js
ui-v17.js
patch-latest.js
```

Small `*-runtime.js` wrappers are acceptable only when they represent a stable runtime boundary/compatibility concern; they must not become a chain of accumulated feature patches.

### Comments

Comments should explain constraints or non-obvious decisions. Do not use source comments as a changelog. Release/history notes belong in `CHANGELOG.md`.

## 5. Protocol changes

Before consuming a new field/event:

1. confirm it from real protocol evidence;
2. document semantics in `docs/PROTOCOL_AND_ANALYTICS.md` and, when generation-specific, `docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md`;
3. reconcile generation-specific/raw shapes in `userscript/protocol-adapter.js`;
4. normalize the canonical event in `domain/events.js`;
5. update tracker/persistence only if the product needs it;
6. add regression coverage;
7. verify that sensitive/raw data is not persisted or logged.

Do not infer fields that have not been observed.

## 6. IndexedDB changes

Current analytics database:

```text
pokepixel_hunt_analyzer
```

Current schema version: `3`.

Schema migrations live in `data/migrations.js`.

Rules:

- never edit a migration that has shipped;
- add a new numbered migration for store/index changes;
- keep migrations forward-only;
- test upgrades from older schema versions;
- ordinary new object properties do not require a migration unless an index/store changes;
- managed connections must remain safe on `versionchange`.

Schema v3 adds the sparse `encounters.captureTicketAtMs` index used by Catch Gallery. v1.12.0 does not add or change an analytics schema.

Custom Audio is intentionally isolated from the analytics database in:

```text
pokepixel_hunt_analyzer_assets
```

Closed HUD configuration, global audio mute and per-Hunt Potion usage support are local presentation/coordination state and do not belong in the analytics database.

## 7. Automated tests

The test suite uses Node's built-in test runner and `fake-indexeddb`.

Coverage areas include:

- config canonicalization/hash;
- encounter correlation/dedupe, including HuntSim kill-sequence correlation and terminal-before-loot ordering;
- Hunt lifecycle/timing;
- rarity/metrics calculations;
- IndexedDB migrations/repositories;
- event-pipeline integration;
- sanitized fixture regression;
- Sound Alert policy, global mute helpers and custom audio persistence;
- Closed HUD catalog, aggregation/formatting and supply-symbol helpers;
- per-Potion usage reconciliation and reload/session reset behavior;
- Capture Ticket eligibility, PNG metadata and remote image loader behavior;
- Catch Gallery filtering/sorting/pagination;
- Hunt deletion ordering and deletion policy;
- userscript metadata/update-channel generation;
- runtime helpers that can be tested without a browser.

Add tests for new behavior or bug fixes whenever the behavior is deterministic outside the live game.

## 8. Manual smoke test

Required after UI/runtime/WebSocket changes:

1. PokePixel connects normally with the production-domain userscript enabled.
2. `window.__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__` returns `true` in the page Console.
3. Closed HUD appears and opens/closes the Analyzer.
4. F5 does not expose the legacy HUD or a temporary zero-value Closed HUD before hydrated data appears.
5. Current updates Seen / XP / Dollar during a Hunt.
6. New Hunt, Pause / Resume and End Hunt work.
7. Captured filters/details work; Failed shows Pokémon / IV / Pokéball / Chance / Fled at directly with Rarity/Shiny/IV filters.
8. Closed HUD configuration persists after reload and presets/Custom switch correctly.
9. Validate representative Closed HUD widgets: Seen/Seen-h, Captured, Dollar/Profit/Expenses, Rare+ metrics and Highest IV.
10. Rarity Tracker works with 1–7 selected rarities; `Show Failed` OFF renders Captured only and ON renders `Failed / Captured` with Captured visually dominant.
11. Shiny Tracker is one fixed `★ Seen / Captured` metric; Seen compacts, Captured stays exact and star/Captured use the gold accent.
12. Ball Tracker shows current inventory + `↓ used`; Ball Success / Failed / Capture Rate / Cost follow the selected Ball and switching between at least two Balls produces independent values.
13. Potion Tracker shows current inventory + `↓ used`; consuming increments, refill does not increment, F5 preserves the same Hunt count and New Hunt resets it.
14. Supply symbols remain visually secondary and separated from their numeric values.
15. Drag, resize, wheel scroll and alpha work.
16. History loads Hunts / Pokémon / Attempts and filters/drill-downs work.
17. DELETE is unavailable for the Running/Paused Current Hunt; after End Hunt, DELETE removes the Hunt and its encounters and remains deleted after refresh/F5.
18. Sound 1 / Sound 2 previews and per-event exclusivity work.
19. Global Sound Alerts Mute blocks new alerts without changing individual choices; Unmute restores playback and reload preserves mute state.
20. Custom Audio import / replace / remove / persistence work.
21. Catch Gallery collapse, filters, sorting and pagination work.
22. Capture Ticket BETA Generate works for Legend / Mythic / Shiny fixtures or eligible real captures.
23. Capture Ticket Copy can be pasted into a compatible target when the browser supports image clipboard writes.
24. F5 preserves IndexedDB data and intended UI state.
25. With two game tabs, only one is ACTIVE and the other is STANDBY.

A clean automated suite does not replace this smoke test for browser behavior.

## 9. Build and release

Production build:

```bash
npm run build:userscript
```

Isolated DEV protocol build:

```bash
npm run build:userscript:dev
```

Production output:

```text
dist/pokepixel-hunt-analyzer.user.js
dist/pokepixel-hunt-analyzer.meta.js
```

The `.meta.js` file contains only the userscript metadata block and is the lightweight endpoint Tampermonkey checks for a newer `@version`. The `.user.js` remains the install/update payload. A DEV build produces only `pokepixel-hunt-analyzer.user.js` and removes any stale production `.meta.js` from `dist/`.

`dist/` is generated and must not be committed under the current release strategy.

Release process:

1. prepare the release version on the validated feature/release branch;
2. update `package.json` and synchronize `package-lock.json`;
3. update README, CHANGELOG and affected technical docs;
4. run `npm ci`, `npm run audit:deps` and `npm run validate`;
5. install/smoke the **production** userscript from that exact branch when runtime behavior changed;
6. require green CI on the release PR;
7. merge the validated release PR into `main`;
8. require green CI on the resulting `main` commit;
9. create `publish/vX.Y.Z` from that exact merged `main` commit and push it;
10. `.github/workflows/publish.yml` verifies version/main alignment, re-runs audit + validation, creates tag `vX.Y.Z`, publishes both update assets and removes the temporary publish branch;
11. verify the release, both assets and the stable `releases/latest/download/...` routes before announcing it.

Mandatory production assets:

```text
pokepixel-hunt-analyzer.meta.js
pokepixel-hunt-analyzer.user.js
```

Their filenames are a compatibility contract with already-installed Tampermonkey scripts and must not be renamed.

The complete update/release contract lives in [`TAMPERMONKEY_UPDATES.md`](TAMPERMONKEY_UPDATES.md) and is normative for every release from v1.11.0 onward.

Do not release from a temporary test/harness branch. The only publication branch pattern is `publish/vX.Y.Z`, created after merge from the current `main` commit.

## 10. Security

Never persist or commit:

```text
tokens
cookies
Authorization headers
credentials
authenticated WebSocket URLs
raw WebSocket captures
private exports
local debug logs
```

The userscript is intentionally passive. Any feature that sends or modifies gameplay traffic is outside the current architecture and requires an explicit product decision.

Capture Ticket external requests are limited to public render assets. Do not attach Hunt payloads, account identifiers or credentials to those requests.
