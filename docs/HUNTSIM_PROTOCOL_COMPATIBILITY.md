# HuntSim protocol compatibility

Status: HuntSim compatibility first prepared for v1.9.0. The v1.15.0 candidate additionally recognizes Expedition run boundaries and routes late correlated HuntSim results into the originating session. Existing offline protocol/reconnect regressions pass; a smoke test of the exact production bundle remains a release gate, not a substitute for these tests.

## Why an adapter exists

The legacy analytics path is encounter-centric and correlates:

```text
combat.started -> loot.received -> capture.failed/capture.success
```

The HuntSim runtime is frame-centric. It emits compact state plus duplicated projections:

```text
hunt.frame
hunt.events
hunt.capture_queue
hunt.kill_reward
hunt.rewards
loot.received (aggregated, per_kill[])
capture.failed / capture.success
```

The domain/persistence model remains unchanged. `userscript/protocol-adapter.js` converts HuntSim traffic into the canonical events consumed by the existing pipeline.

## Canonical sources

| Analytics concern | HuntSim source | Rule |
| --- | --- | --- |
| Session/config context | session-only `combat.started` + `hunt.analyzer_reset` | Context only; session-only combat event is not forwarded to the domain pipeline. |
| Target identity | `hunt.capture_queue` + `hunt.events` + full `hunt.frame` | Kill sequence becomes the stable local correlation key. |
| Fight start | first HuntSim `hit` observed for the target slot | Used for cycle time when available. |
| Capture result | `capture.failed` / `capture.success` | Authoritative terminal event; `hunt.events` capture projections are ignored. |
| Reward | `loot.received.per_kill[]` | Aggregated reward is split into one canonical loot event per kill; observed `items[]` preserves only bounded `item_id` + `qty`. |
| No-capture closure | `hunt.capture_queue.rm[]` | Emits internal `hunt.kill_closed` after loot when no terminal capture exists. |
| Expedition start | `expedition.run_started.lobby.id` | Opens a local Expedition identified by its run ID. |
| Expedition recovery | `expedition.run_updated.id` / `expedition.run_live.run_id` | Recovers the same session after reconnect. |
| Expedition end | `expedition.run_finished.run_id` | Ends only the matching run, regardless of end reason. |

The following are intentionally ignored as duplicate projections:

- `hunt.kill_reward`
- `hunt.rewards`
- `hunt.events` capture success/failure projection
- `rare.captured`
- `shiny.captured`

## Correlation key

HuntSim no longer provides the legacy `wild_monster_id` across every event. The adapter creates:

```text
huntsim:<server-session-or-zone>:<kill-seq>
```

`hunt.capture_queue.add[].id`, `hunt.events[].cap.id` and `loot.received.per_kill[].seq` were observed to represent the same HuntSim kill sequence.

An Expedition's `run_id` is distinct from its transport's
`loot.received.session_id`. A switch to/from Expedition rotates the HuntSim
kill registry; at most two previous registries are retained for the normal
bounded 60-second correlation window. Late rewards with a recognized older
transport session are linked to the originating encounter rather than the
current activity. Unknown cross-activity origins are not guessed.

`node --test tests/integration/expeditionLifecycle.test.js` simulates
the transitions with sanitized server-event shapes and covers reconnect,
voluntary exit, expiry, old rewards and the Current title. This is an offline
test, not a substitute for manual verification in the game.

## Full frame decoder

Only `hunt.frame` with `kind=full` is decoded. Delta frames are not required for analytics.

Observed full-frame entity directory:

- fixed 35-byte header;
- entity metadata record: 16 bytes plus UTF-8 species string;
- wild entity type: `2`;
- slot: byte `+0`;
- map event id: byte `+3`;
- x/y: bytes `+4/+5`;
- HP/max HP: big-endian uint16 at `+8/+10`;
- level: byte `+13`;
- shiny flag: bit 0 at `+14`;
- species string length: byte `+15`.

The frame is used only for correlation metadata. Its Shiny flag is not trusted as terminal truth because map slots can respawn between periodic full frames.

## Capture detail policy

### Successful capture

`capture.success.creature` is used to fill fields missing from the synthetic HuntSim target:

- Rarity/quality;
- IV breakdown / IV total;
- Shiny;
- Elements;
- Gender;
- Nature;
- Quality Multiplier;
- Captured By name.

`creature.level` is never used as target level. HuntSim can return a captured creature at a rebased level that differs from the hunted target.

A complete legacy `combat.started` snapshot wins for individual target fields. This preserves legacy behavior while allowing HuntSim to recover details that otherwise have no authoritative target snapshot.

### Failed capture

Observed `capture.failed` exposes:

- species;
- target level;
- Rarity/quality;
- IV total;
- Shiny;
- capsule/chance/cost.

It does **not** expose Gender, Nature, full IV breakdown, Elements or Quality Multiplier. Those fields remain `null` for failed HuntSim attempts unless a future protocol event provides an authoritative target snapshot. The adapter must not invent them.

## Event ordering

HuntSim commonly emits terminal capture events before `loot.received`. The tracker therefore keeps the finalized encounter correlated in memory until late loot arrives, patches reward fields on the same persisted encounter, then releases the correlation.

Legacy ordering (loot before capture) remains supported unchanged.

When `loot.received.per_kill[].items[]` is present, the adapter keeps only the observed item identifier and quantity. Names, rarity and per-item value are not part of the confirmed HuntSim reward item contract and are not synthesized or apportioned from aggregate `loot_sell_value`.

## Build targets

The default build is release-safe and targets production with the historical userscript identity/namespace:

```bash
npm run build:userscript
```

For future HuntSim smoke tests, an explicit isolated DEV build remains available:

```bash
npm run build:userscript:dev
```

The DEV build uses its own `@name`, namespace, `-dev` version suffix and `https://dev.pokepixel.nietore.com/*` match, so it cannot replace the installed production userscript.

## Deployment gate

The adapter is backward-compatible with legacy traffic: legacy canonical events pass through unchanged. The v1.9 branch is technically merge-ready, but release timing is intentionally gated on the HuntSim server update reaching production so the release aligns with the game protocol transition.
