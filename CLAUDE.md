# PokePixel Hunt Analyzer

## Project

Standalone Microsoft Edge / Chromium Manifest V3 extension for passive, local PokePixel hunt analytics.

Current baseline: v1.0.0.

The current extension works and must be evolved incrementally. Do not rewrite working code without a concrete migration reason.

## Source of truth

Before architectural or persistence changes, read:

- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL_AND_ANALYTICS.md`
- `docs/DEVELOPMENT.md`

Keep `CLAUDE.md` concise. Detailed product/protocol rules belong in `docs/`.

## Core constraints

- Keep Manifest V3 and the Side Panel.
- Keep the extension standalone in v1.
- Use IndexedDB for persistent normalized history.
- Do not introduce Native Messaging, SQLite, `%LOCALAPPDATA%` writes, cloud storage, or a local backend in v1.
- Observe PokePixel WebSocket traffic passively.
- Never send, replay, modify, or automate gameplay WebSocket messages.
- Never persist tokens, cookies, Authorization headers, authenticated WebSocket URLs, or raw WebSocket frames.
- Keep host permissions minimal.

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
Time while Edge/browser is closed must not count as active Hunt time.

## Development workflow

For multi-file or architectural changes:

1. inspect current code and relevant docs;
2. use Plan Mode;
3. identify files and tests;
4. present the plan;
5. wait for approval before implementation;
6. implement only the approved phase;
7. run tests and report results.

Avoid unrelated refactors.
Do not add dependencies solely because a generic skill recommends them.

## Git

- Keep commits small and coherent.
- Preserve the working v0.3.0 baseline before migration.
- Do not commit release ZIPs, user exports, temporary/debug data, secrets, or machine-local Claude settings.
- Do not mark `v1.0.0` until the release criteria in `docs/DEVELOPMENT.md` pass.
