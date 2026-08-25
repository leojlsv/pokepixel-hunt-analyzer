# HuntSim protocol compatibility

Status: v1.9.0 release-ready compatibility layer. Validated against the HuntSim DEV protocol; merge/release is intentionally gated on the game update reaching production.

## Why an adapter exists

The legacy analytics path are encounter-centric and correlate:

```text
combat.started -> loot.received -> capture.failed/capture.success
```

The DEV HuntSim runtime is frame-centric. It emits compact state and duplicated projections:

```text
hunt.frame
hunt.events
hunt.capture_queue
hunt.kill_reward
hunt.rewards
loot.received (aggregated, per_kill[])
capture.failed / capture.success
```

The domain/persistence model remains unchanged. `userscript/protocol-adapter.js` converts HuntSim traffic into the canonical events already consumed by the canonical pipeline.

## Canonical sources

| Analytics concern | HuntSim source | Rule |
| --- | --- | --- |
| Session/config context | session-only `combat.started` + `hunt.analyzer_reset` | Context only; session-only combat event is not forwarded to the domain pipeline. |
| Target identity | `hunt.capture_queue` + `hunt.events` + full `hunt.frame` | Kill sequence becomes the stable local correlation key. |
| Fight start | first HuntSim `hit` observed for the target slot | Used for cycle time when available. |
| Capture result | `capture.failed` / `capture.success` | Authoritative terminal event; `hunt.events` capture projections are ignored. |
| Reward | `loot.received.per_kill[]` | Aggregated reward is split into one canonical loot event per kill. |
| No-capture closure | `hunt.capture_queue.rm[]` | Emits internal `hunt.kill_closed` after loot when no terminal capture exists. |

The following are intentionally ignored as duplicate projections:

- `hunt.kill_reward`
- `hunt.rewards`
- `hunt.events` capture success/failure projection
- `rare.captured`
- `shiny.captured`

## Correlation key

DEV no longer provides the legacy `wild_monster_id` across every event. The adapter creates:

```text
huntsim:<server-session-or-zone>:<kill-seq>
```

`hunt.capture_queue.add[].id`, `hunt.events[].cap.id` and `loot.received.per_kill[].seq` were observed to represent the same HuntSim kill sequence.

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

The frame is used only for correlation metadata. Its shiny flag is not trusted as terminal truth because map slots can respawn between periodic full frames.

## Capture detail policy

### Successful capture

`capture.success.creature` is used to fill fields missing from the synthetic HuntSim start:

- quality;
- IV breakdown / IV total;
- shiny;
- elements;
- gender;
- nature;
- quality multiplier;
- captured-by name.

`creature.level` is never used as the target level. DEV can return a captured creature at a rebased level that differs from the hunted target.

A complete legacy `combat.started` snapshot always wins for non-terminal individual fields. This preserves PROD behavior.

### Failed capture

Observed `capture.failed` exposes:

- species;
- target level;
- quality;
- IV total;
- shiny;
- capsule/chance/cost.

It does **not** expose gender, nature, full IV breakdown, elements or quality multiplier. Those fields remain `null` for failed HuntSim attempts unless a future protocol event provides an authoritative target snapshot. The adapter must not invent them.

## Event ordering

HuntSim commonly emits capture terminal events before `loot.received`. The tracker therefore keeps the finalized encounter correlated in memory until late loot arrives, then patches reward fields on the same persisted encounter and releases the correlation.

Legacy PROD ordering (loot before capture) remains supported unchanged.

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
