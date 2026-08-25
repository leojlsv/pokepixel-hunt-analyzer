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

`validate` runs the complete Node test suite and builds the production userscript.

## 2. Source layout

```text
userscript/   browser runtime and UI
domain/       business rules and pure calculations
data/         IndexedDB and repositories
services/     application/event coordination
tests/        unit, integration and sanitized fixtures
scripts/      build/development utilities
docs/         architecture and protocol decisions
```

See `docs/ARCHITECTURE.md` for detailed responsibilities.

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

Before opening a PR:

```bash
npm ci
npm run audit:deps
npm run validate
```

For runtime/UI changes, also perform the manual smoke test in section 8.

## 4. Code rules

### Boundaries

- Runtime/browser integration belongs in `userscript/`.
- Generation-specific protocol reconciliation belongs in `userscript/protocol-adapter.js`; canonical event normalization belongs in `domain/events.js`.
- Metrics/formulas belong in domain modules, not the UI.
- IndexedDB access belongs in `data/` repositories.
- Cross-module application coordination belongs in `services/`.

Avoid bypassing these boundaries for convenience.

### Tampermonkey runtime boundary

The production userscript currently uses:

```text
@sandbox raw
@grant GM_xmlhttpRequest
@grant unsafeWindow
@connect img.pokemondb.net
```

Do not assume the userscript's `window` is the page's JavaScript global when privileged grants are present.

Any integration with page-owned runtime objects, especially `WebSocket`, must resolve and use the page window explicitly. DOM, IndexedDB, localStorage and Web Audio remain normal userscript/browser responsibilities.

Adding or removing `@grant`, `@sandbox` or `@connect` is a runtime/security change and requires:

1. explicit justification;
2. automated coverage where possible;
3. a live WebSocket smoke test before merge.

### Side effects

Keep side effects at runtime and persistence boundaries. Prefer pure functions for calculations, normalization and grouping.

### Duplication

Do not duplicate:

- protocol parsing;
- metric formulas;
- IndexedDB reads for data already loaded by the caller;
- render pipelines;
- application version constants.

`package.json` is the authoritative application version. `package-lock.json` must be synchronized before release.

### File organization

Prefer modules named by responsibility.

Do not create runtime files such as:

```text
fix-v162.js
ui-v17.js
patch-latest.js
```

Modify or extract the responsible module instead.

### Comments

Comments should explain constraints or non-obvious decisions.

Do not use source comments as a changelog. Release/history notes belong in `CHANGELOG.md`.

## 5. Protocol changes

Before consuming a new field/event:

1. confirm it from real protocol evidence;
2. document semantics in `docs/PROTOCOL_AND_ANALYTICS.md` (and `docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md` when generation-specific);
3. reconcile generation-specific/raw shapes in `userscript/protocol-adapter.js`;
4. normalize the resulting canonical event in `domain/events.js`;
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

Schema v3 adds the sparse `encounters.captureTicketAtMs` index used by Catch Gallery. It must not backfill or invent historical Capture Ticket eligibility.

Custom Audio is intentionally isolated from the analytics database in:

```text
pokepixel_hunt_analyzer_assets
```

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
- Sound Alert policy and custom audio persistence;
- Capture Ticket eligibility, PNG metadata and remote image loader behavior;
- Catch Gallery filtering/sorting/pagination;
- Hunt deletion ordering and deletion policy;
- runtime helpers that can be tested without a browser.

Add tests for new behavior or bug fixes whenever the behavior is deterministic outside the live game.

## 8. Manual smoke test

Required after UI/runtime/WebSocket changes:

1. PokePixel connects normally with the userscript enabled.
2. `window.__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__` returns `true` in the page Console.
3. HUD appears and opens/closes the Analyzer.
4. Current updates Seen / XP / Dollar during a Hunt.
5. New Hunt works.
6. Pause / Resume works.
7. End Hunt works.
8. Captured filters/details work; Failed shows Pokémon / IV / Pokéball / Fled at directly with Rarity/Shiny/IV filters.
9. HUD minimized values update.
10. Drag, resize, wheel scroll and alpha work.
11. History loads Hunts / Pokémon / Attempts and its filters/drill-downs work.
12. DELETE is unavailable for the Running/Paused Current Hunt.
13. After End Hunt, DELETE removes the Hunt and its encounters; it remains absent after History refresh and F5.
14. Sound 1 / Sound 2 previews and per-event exclusivity work.
15. Custom Audio import / replace / remove / persistence work.
16. Catch Gallery collapse, filters, sorting and pagination work.
17. Capture Ticket BETA Generate works for Legend / Mythic / Shiny fixtures or eligible real captures.
18. Capture Ticket Copy can be pasted into a compatible target when the browser supports image clipboard writes.
19. F5 preserves IndexedDB data and UI state.
20. With two game tabs, only one is ACTIVE and the other is STANDBY.

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

Output:

```text
dist/pokepixel-hunt-analyzer.user.js
```

`dist/` is generated and must not be committed under the current release strategy.

Release process:

1. create `release/vX.Y.Z` from the fully validated feature stack;
2. apply release-only cleanup and remove temporary harness/debug code;
3. update `package.json` and synchronize `package-lock.json`;
4. update README, CHANGELOG and affected technical docs;
5. run `npm ci`;
6. run `npm run audit:deps`;
7. run `npm run validate`;
8. build/install the **production** userscript from that exact release branch and complete section 8; for a protocol transition, also validate the isolated DEV build before the game update reaches production;
9. open the release PR against `main` and require green CI;
10. merge the validated release PR;
11. tag the merged commit as `vX.Y.Z`;
12. publish the GitHub Release with the generated `pokepixel-hunt-analyzer.user.js` asset.

Do not release from a temporary test/harness branch.

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

Capture Ticket's external requests are limited to public render assets. Do not attach Hunt payloads, account identifiers or credentials to those requests.
