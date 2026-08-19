# Development

## 1. Requirements

- Node.js 24+
- npm
- Tampermonkey for live smoke testing

Install dependencies:

```bash
npm install
```

Validate the project:

```bash
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
git pull
git switch -c feat/my-change
```

Recommended branch prefixes:

```text
feat/
fix/
refactor/
docs/
```

Keep changes focused. A refactor should not quietly change formulas or product behavior.

Before opening a PR:

```bash
npm run validate
```

For runtime/UI changes, also perform the manual smoke test in section 8.

## 4. Code rules

### Boundaries

- Runtime/browser integration belongs in `userscript/`.
- Protocol normalization belongs in `domain/events.js`.
- Metrics/formulas belong in domain modules, not the UI.
- IndexedDB access belongs in `data/` repositories.
- Cross-module application coordination belongs in `services/`.

Avoid bypassing these boundaries for convenience.

### Side effects

Keep side effects at runtime and persistence boundaries. Prefer pure functions for calculations, normalization and grouping.

### Duplication

Do not duplicate:

- protocol parsing;
- metric formulas;
- IndexedDB reads for data already loaded by the caller;
- render pipelines;
- application version constants.

`package.json` is the authoritative application version.

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
2. document semantics in `docs/PROTOCOL_AND_ANALYTICS.md`;
3. normalize it in `domain/events.js`;
4. update tracker/persistence only if the product needs it;
5. add regression coverage;
6. verify that sensitive/raw data is not persisted.

Do not infer fields that have not been observed.

## 6. IndexedDB changes

Current database:

```text
pokepixel_hunt_analyzer
```

Schema migrations live in `data/migrations.js`.

Rules:

- never edit a migration that has shipped;
- add a new numbered migration for store/index changes;
- keep migrations forward-only;
- test upgrades from older schema versions;
- ordinary new object properties do not require a migration unless an index/store changes.

## 7. Automated tests

The test suite uses Node's built-in test runner and `fake-indexeddb`.

Coverage areas include:

- config canonicalization/hash;
- encounter correlation/dedupe;
- Hunt lifecycle/timing;
- rarity/metrics calculations;
- IndexedDB migrations/repositories;
- event-pipeline integration;
- sanitized fixture regression;
- runtime helpers that can be tested without a browser.

Add tests for new behavior or bug fixes whenever the behavior is deterministic outside the live game.

## 8. Manual smoke test

Required after UI/runtime/WebSocket changes:

1. PokePixel connects normally with the userscript enabled.
2. HUD appears and opens the analyzer.
3. Current updates during a Hunt.
4. New Hunt works.
5. Pause / Resume works.
6. End Hunt works.
7. Seen / Captured / Failed / Capture are correct.
8. By Rarity updates.
9. Captured/Failed filters work.
10. HUD minimized values update.
11. Drag, resize, wheel scroll and alpha work.
12. Compare loads, filters and sorts.
13. F5 preserves IndexedDB data and UI state.
14. With two game tabs, only one is ACTIVE and the other is STANDBY.

A clean automated suite does not replace this smoke test for browser behavior.

## 9. Build and release

Build only:

```bash
npm run build:userscript
```

Output:

```text
dist/pokepixel-hunt-analyzer.user.js
```

Release process:

1. validate automated tests/build;
2. complete live smoke test;
3. update `package.json` using SemVer;
4. update `CHANGELOG.md`;
5. rebuild the userscript;
6. commit/tag the validated version;
7. attach the generated `.user.js` to the GitHub Release.

Generated `dist/` output should not be committed to the repository unless the project explicitly changes its release strategy.

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
