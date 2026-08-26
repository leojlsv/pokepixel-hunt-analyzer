# PokePixel Hunt Analyzer

## Project

Standalone Tampermonkey userscript for passive, local PokePixel Hunt analytics.

Current architecture baseline: v1.9.x.

The userscript is production-oriented and must be evolved incrementally. Preserve validated behavior unless a change has a concrete reason and test path.

## Source of truth

Before architectural, protocol, or persistence changes, read:

- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL_AND_ANALYTICS.md`
- `docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md`
- `docs/DEVELOPMENT.md`

Keep `CLAUDE.md` concise. Detailed product/protocol rules belong in `docs/`.

## Core constraints

- Tampermonkey is the supported runtime. Do not reintroduce Manifest V3, Side Panel, service-worker, content-script, or extension-only adapters.
- Build from `userscript/main.js` through `scripts/build-userscript.mjs`.
- `npm run build:userscript` is the production build; `npm run build:userscript:dev` is the isolated DEV-protocol build.
- Preserve the historical production userscript namespace; changing it can break Tampermonkey update identity.
- Use IndexedDB for persistent normalized Hunt history.
- Do not introduce Native Messaging, SQLite, machine-local file writes, cloud storage, or a local backend unless explicitly requested.
- Observe PokePixel WebSocket traffic passively.
- Never send, replay, modify, or automate gameplay WebSocket messages.
- Never persist tokens, cookies, Authorization headers, authenticated WebSocket URLs, or raw WebSocket frames.
- Reconcile generation-specific raw protocol shapes in `userscript/protocol-adapter.js`; normalize canonical event fields in `domain/events.js`.
- Keep one authoritative application version: `package.json`, injected into both PROD and DEV userscript builds.
- Avoid MutationObserver/polling when the producer already has the state needed to render directly.

## Identity

- `session_id`: local Hunt UUID.
- `encounter_id`: local encounter UUID.
- `wild_monster_id`: temporary protocol correlation key only; never DB PK.
- HuntSim synthetic correlation key: `huntsim:<server-session-or-zone>:<kill-seq>`.
- `config_id`: immutable configuration snapshot.
- `group_key`: `species_id | level | config_id`.

## Protocol rules

- Legacy canonical events pass through `protocol-adapter.js` unchanged.
- HuntSim raw events are reconciled into canonical events before `domain/events.js` / `eventPipeline.js`.
- Prefer `combat.started.data.session.auto_capture` as the capture configuration source when available.
- EXP rate remains manual/unknown until a reliable protocol field is proven.
- Preserve target level from an authoritative target snapshot/correlation source.
- Never replace target level with `capture.success.data.creature.level`.
- Successful HuntSim captures may enrich fields missing from a synthetic/unmatched target with authoritative `capture.success.data.creature` metadata.
- Failed HuntSim captures must keep unsupported details null; do not infer Gender, Nature, full IV breakdown, Elements or Quality Multiplier when the terminal event does not expose them.
- Treat cumulative `session.summary` snapshots as cumulative; do not sum them as per-event rewards.
- Split HuntSim aggregated `loot.received.per_kill[]` into canonical per-kill rewards exactly once.
- Ignore duplicate HuntSim projections such as `hunt.kill_reward`, `hunt.rewards` and capture projections inside `hunt.events` when an authoritative terminal/reward source already exists.
- Normalize only fields required by analytics.

## Time

Never use `seconds++` or another incrementing UI timer as authoritative time.
Use timestamps plus accumulated active milliseconds.
Time while the browser is closed must not count as active Hunt time.

## Code quality

- Prefer modules organized by responsibility over version-named patch files.
- Remove dead code instead of hiding or leaving compatibility wrappers without callers.
- Do not duplicate DB reads, protocol parsing/reconciliation, metrics calculation, or rendering pipelines.
- Keep side effects at runtime boundaries; keep domain modules browser-API agnostic.
- Use explicit names and small functions; comments should explain non-obvious constraints, not narrate changelog history.
- Record release/history notes in `CHANGELOG.md`, never as changelog comments inside source files.
- Add dependencies only when they solve a concrete project need.

## Validation

Before considering a change complete:

```bash
npm ci
npm run audit:deps
npm run validate
```

For HuntSim/protocol work, also validate the isolated build when relevant:

```bash
npm run build:userscript:dev
```

For UI/runtime changes, perform a manual smoke test on the appropriate PokePixel environment: WebSocket hook, Current, History, Hunt actions, Captured/Failed, HUD, resize/drag/scroll, persistence, Sound Alerts, Catch Gallery/Capture Ticket and multi-tab ACTIVE/STANDBY.

## Git

- Use an isolated branch for architectural or multi-file refactors; `dev/` is appropriate for server/protocol compatibility work.
- Keep commits small and coherent.
- Keep a validated baseline available until the replacement passes smoke testing.
- Do not commit generated release bundles, exports, temporary/debug data, secrets, raw traffic captures or machine-local settings unless explicitly required.
- Do not merge a release/protocol branch until its deployment gate is satisfied and merge approval is explicit.
