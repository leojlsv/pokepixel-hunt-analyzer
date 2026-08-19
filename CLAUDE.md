# PokePixel Hunt Analyzer

## Project

Standalone Tampermonkey userscript for passive, local PokePixel hunt analytics.

Current architecture baseline: v1.6.x.

The userscript is production-oriented and must be evolved incrementally. Preserve validated behavior unless a change has a concrete reason and test path.

## Source of truth

Before architectural, protocol, or persistence changes, read:

- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL_AND_ANALYTICS.md`
- `docs/DEVELOPMENT.md`

Keep `CLAUDE.md` concise. Detailed product/protocol rules belong in `docs/`.

## Core constraints

- Tampermonkey is the supported runtime. Do not reintroduce Manifest V3, Side Panel, service-worker, content-script, or extension-only adapters.
- Build from `userscript/main.js` through `scripts/build-userscript.mjs`.
- Use IndexedDB for persistent normalized Hunt history.
- Do not introduce Native Messaging, SQLite, machine-local file writes, cloud storage, or a local backend unless explicitly requested.
- Observe PokePixel WebSocket traffic passively.
- Never send, replay, modify, or automate gameplay WebSocket messages.
- Never persist tokens, cookies, Authorization headers, authenticated WebSocket URLs, or raw WebSocket frames.
- Normalize protocol data in `domain/events.js`; do not duplicate protocol normalization in UI/runtime adapters.
- Keep one authoritative application version: `package.json`, injected into the userscript build.
- Avoid MutationObserver/polling when the producer already has the state needed to render directly.

## Identity

- `session_id`: local Hunt UUID.
- `encounter_id`: local encounter UUID.
- `wild_monster_id`: temporary protocol correlation key only; never DB PK.
- `config_id`: immutable configuration snapshot.
- `group_key`: `species_id | level | config_id`.

## Protocol rules

- Prefer `combat.started.data.session.auto_capture` as the capture configuration source when available.
- EXP rate remains manual/unknown until a reliable protocol field is proven.
- Preserve encounter level from `combat.started`.
- Never replace target level with `capture.success.data.creature.level`.
- Treat cumulative `session.summary` snapshots as cumulative; do not sum them as per-event rewards.
- Normalize only fields required by analytics.

## Time

Never use `seconds++` or another incrementing UI timer as authoritative time.
Use timestamps plus accumulated active milliseconds.
Time while the browser is closed must not count as active Hunt time.

## Code quality

- Prefer modules organized by responsibility over version-named patch files.
- Remove dead code instead of hiding or leaving compatibility wrappers without callers.
- Do not duplicate DB reads, protocol parsing, metrics calculation, or rendering pipelines.
- Keep side effects at runtime boundaries; keep domain modules browser-API agnostic.
- Use explicit names and small functions; comments should explain non-obvious constraints, not narrate changelog history.
- Record release/history notes in `CHANGELOG.md`, never as changelog comments inside source files.
- Add dependencies only when they solve a concrete project need.

## Validation

Before considering a change complete:

```bash
npm run validate
```

This runs the Node test suite and builds the Tampermonkey userscript.
For UI/runtime changes, also perform a manual smoke test on PokePixel: connection, Current, Compare, Hunt actions, filters, HUD, resize/drag/scroll, persistence, and multi-tab ACTIVE/STANDBY.

## Git

- Use an isolated branch for architectural or multi-file refactors.
- Keep commits small and coherent.
- Keep a validated baseline available until the replacement passes smoke testing.
- Do not commit generated release bundles, exports, temporary/debug data, secrets, or machine-local settings unless explicitly required.
