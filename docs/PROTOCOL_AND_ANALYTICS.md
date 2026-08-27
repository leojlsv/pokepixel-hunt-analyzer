# Protocol and Analytics

This document distinguishes fixture-confirmed protocol data from product decisions. Do not silently infer unsupported fields.

## 1. Protocol generations and canonical inbound events

The domain pipeline consumes one canonical event model:

```text
combat.started
loot.received
capture.success
capture.failed
hunt.stopped
hunt.analyzer_reset
```

Legacy traffic already arrives in this shape. HuntSim additionally emits raw `hunt.frame`, `hunt.events`, `hunt.capture_queue`, `hunt.kill_reward` and `hunt.rewards` messages. `userscript/protocol-adapter.js` reconciles HuntSim traffic into the canonical events above before `domain/events.js` and `services/eventPipeline.js` process it.

One raw HuntSim message may emit zero, one or multiple canonical events. Duplicate projections are intentionally ignored. Raw WebSocket frames are never persisted.

See `docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md` for the generation-specific decoder and correlation contract.

## 2. `combat.started`

Legacy extract when present:

```text
seq
ts
enemy.id
enemy.species_id
enemy.level
enemy.quality
enemy.is_shiny
enemy.ivs
enemy.map_id
enemy.zone_id
enemy.elements
enemy.gender
enemy.nature
enemy.quality_multiplier
session.id
session.auto_capture
```

`enemy.elements`, `enemy.gender`, `enemy.nature`, `enemy.ivs` and `enemy.quality_multiplier` are confirmed from real legacy traffic. `quality_multiplier` is continuous (for example `1.02`) and is distinct from discrete `quality`/Rarity (`weak`, `common`, ..., `mythical`).

The six persisted IV fields are:

```text
hp
atk
def
spa
spd
spe
```

`domain/ivTotal.js` derives the total while the raw per-stat object is kept for display/filtering.

Under the legacy protocol, a complete `combat.started.data.enemy` snapshot is the authoritative individual snapshot. Under HuntSim there may be no equivalent full target snapshot; successful terminal `capture.success.creature` data may therefore fill fields missing from the synthetic/unmatched target. Failed HuntSim attempts expose only the subset documented in §4.

The game `session.id` is metadata (`serverSessionId`), not the local `session_id`. `session.summary` is cumulative; never sum repeated snapshots as incremental rewards.

The HuntSim session-only `combat.started` shape has no `enemy`. The protocol adapter consumes its session/map/zone/config context but does not forward it as a canonical encounter start.

## 3. `loot.received`

### Legacy individual reward

Extract:

```text
ts
wild_monster_id
species_id
exp
trainer_exp
pokemon_exp
gold
loot_sell_value
auto_potion_used
supply_cost
```

Primary legacy encounter cycle:

```text
cycle_ms = loot.ts - combat.started.ts
```

UI label: `Target Cycle`. Do not call it pure combat time.

### HuntSim aggregated reward

HuntSim may aggregate rewards in an envelope containing:

```text
kills
session_id
per_kill[]
```

Each `per_kill[]` entry is converted by the adapter into exactly one canonical individual reward correlated by HuntSim kill sequence. Envelope totals must not be counted again after splitting.

HuntSim commonly emits terminal capture before `loot.received`; late reward must patch the already-persisted encounter instead of creating a second row.

### Auto-potion variant

`loot.received` also has a mutually exclusive auto-potion shape with no `wild_monster_id`:

```text
auto_potion_used
supply_cost
```

This is a trainer-wide expense, not a wild encounter. It only updates session expense counters and never creates an encounter row.

## 4. `capture.failed`

Canonical extract:

```text
ts
wild_monster_id
species_id
species_name
level
quality
iv_total
is_shiny
capsule_item_id
capsule_name
chance
supply_cost
```

`chance` is stored as a fraction; UI converts it to percentage.

Observed HuntSim `capture.failed` provides authoritative target `level`, Rarity/`quality`, `iv_total`, Shiny and capsule/chance/cost. It does **not** provide Gender, Nature, full IV breakdown, Elements or Quality Multiplier. Those fields remain `null` unless a future authoritative source is observed. Do not infer them.

## 5. `capture.success`

Canonical extract when present:

```text
ts
wild_monster_id
species_id
species_name
capsule_item_id
capsule_name
chance
supply_cost
auto_sold
auto_sell_value
captured_by_name
creature.quality
creature.is_shiny
creature.ivs
creature.elements
creature.gender
creature.nature
creature.quality_multiplier
creature.captured_by_name
```

`auto_sold = true` is still a successful capture.

Never use `creature.level` as hunted target level. DEV can return a captured creature at a rebased level that differs from the target.

A complete legacy `combat.started` snapshot remains preferred for target-individual fields. HuntSim may have no equivalent complete target snapshot; in that case successful terminal `creature` fields are authoritative for the missing persisted details. Unmatched HuntSim successes retain those terminal fields instead of degrading to mostly-empty orphan rows.

`capturedByName` accepts the observed top-level `captured_by_name` and the nested `creature.captured_by_name` location. This is required by new Capture Ticket eligibility/data.

## 6. Correlation

Temporary tracker lookup remains:

```javascript
activeByWildMonsterId.set(wildMonsterId, encounterId)
```

### Legacy

```text
combat.started
      ↓
loot.received
      ↓
capture.success / capture.failed
```

Do not remove legacy correlation at `loot.received` if a later capture result still needs to attach.

A new `combat.started` reusing the same wild id only creates a new encounter when the full individual fingerprint is genuinely different. Re-announcing the same individual refreshes the existing draft instead of duplicating it.

### HuntSim

```text
hunt.frame / hunt.capture_queue / hunt.events
                  ↓ kill sequence
capture.success / capture.failed
                  ↓
loot.received.per_kill[]   (may arrive after terminal capture)
```

The adapter synthesizes:

```text
wildMonsterId = huntsim:<server-session-or-zone>:<kill-seq>
```

Observed correlation sources:

```text
hunt.capture_queue.add[].id
hunt.events[].cap.id
loot.received.per_kill[].seq
```

These represent the HuntSim kill sequence used as the stable local correlation key.

The tracker keeps a finalized HuntSim encounter correlated long enough for late loot to patch the same persisted row, then releases it after reward reconciliation/closure.

## 7. Wild-id reuse and orphans

A new legacy start with a **genuinely different** individual on a reused wild id creates a new `encounter_id`. Do not force orphan events onto old encounters just because the wild id matches.

Useful unmatched terminal data may be stored with `state = orphan`. Orphans are excluded from metrics that require reliable `cycle_ms`, but a real capture attempt still counts toward Seen/Captured/Failed.

**Not every repeated `combat.started` is reuse.** Real legacy captures confirmed that the game can re-announce the exact same individual with identical species/level/Rarity/Gender/Nature/IVs/Quality Multiplier. Compare the full individual fingerprint before finalizing. If it matches, refresh the same encounter instead of creating a duplicate.

**Not every unmatched `loot.received` is an orphan.** The auto-potion variant (§3) intentionally has no `wild_monster_id`; it updates session expenses only.

For HuntSim, an unmatched `capture.success` preserves authoritative terminal creature metadata. An unmatched `capture.failed` preserves the authoritative subset carried by that terminal event.

## 8. Dedupe and reconnection

Assign a local `socketId` to each observed WebSocket instance.

Canonical dedupe identity:

```text
socketId | eventType | seq
```

Do not treat `seq` as globally unique; it may restart after reconnection.

HuntSim also emits multiple projections of the same gameplay outcome. Protocol-level reconciliation must prevent these from reaching analytics as separate captures/rewards. In particular, do not double count:

```text
hunt.kill_reward
hunt.rewards
hunt.events capture success/failure projections
rare.captured
shiny.captured
```

when the authoritative terminal/reward source has already been selected.

## 9. Timestamp priority

```text
1. server event `ts`
2. local received timestamp (`Date.now()`)
```

Do not use Burp/export timestamps for live duration calculations.

## 10. Session metrics

```text
Trainer EXP/h = Σ trainer_exp / active_hours
Pokémon EXP/h = Σ pokemon_exp / active_hours
Dollar/h      = Σ (gold + loot_sell_value + (auto_sold ? auto_sell_value : 0)) / active_hours
Profit        = Dollar - Expenses
```

`Dollar/h` counts the wild monster's direct `loot.received.gold`, the persisted `loot.received.loot_sell_value`, and, when a captured Pokémon was auto-sold, `auto_sell_value`. `loot_sell_value` is part of Hunt revenue even though it is represented separately from direct gold in the protocol.

If active time is zero, display `—`.

`Seen` is an exact identity:

```text
Seen = Captured + Failed
```

A Pokémon only counts as Seen if a capture was actually attempted. An unresolved/incomplete fight without a capture attempt is not Seen. An orphan row can still be Seen if it contains a real terminal capture attempt.

Capture rates:

```text
Seen → Capture = captured / seen
Attempt Rate   = captured / (captured + failed)
```

Rare+ is:

```text
rare + epic + legendary + mythical
```

Track `shinySeen`, `shinyCaptured` and `shinyFailed` per Rarity tier as annotations already included in the corresponding plain counts, never as additive totals. Current's By Rarity table renders `Qty (ShinyQty)` when a Shiny sub-count exists.

Hunt expenses:

```text
Expenses/h = (Σ encounter.supply_cost [Capsules] + session.potionsCost [Potions]) / active_hours
```

Capsule cost is encounter-scoped. Potion cost is session-scoped because the auto-potion signal has no encounter identity. Do not invent a per-Pokémon allocation for potion expenses.

## 11. Group analytics

Do not assign the entire session time to every `group_key`.

```text
group_cycle_ms = Σ encounter.cycle_ms
Trainer EXP / Cycle Hour = Σ trainer_exp / (group_cycle_ms / 3600000)
Dollar / Cycle Hour      = Σ (gold + loot_sell_value + (auto_sold ? auto_sell_value : 0)) / (group_cycle_ms / 3600000)
```

UI must distinguish session rates from cycle-based group rates.

No group-level potion expense is calculated because potion cost is session-scoped and the protocol does not provide an authoritative allocation to a species/level/config group.

## 12. Reference baselines

### Legacy sanitized fixture

Known event counts:

```text
combat.started       1,359
loot.received        1,631
capture.failed       1,262
capture.success         58
hunt.analyzer_reset      8
hunt.stopped             6
```

Known failed-capture Rarity counts:

```text
weak         239
common       608
uncommon     282
rare         106
epic          25
legendary      1
mythical       1
Rare+        133
```

The fixture includes wild-id reuse and orphan cases. The current full replay persists **4,128 encounter rows** and is the legacy regression baseline.

### HuntSim DEV evidence

The DEV capture used for v1.9 compatibility validation contained approximately:

```text
hunt.frame          7,209
hunt.capture_queue    681
hunt.events           628
hunt.kill_reward      312
hunt.rewards          309
loot.received         309
capture.failed        249
capture.success        46
```

These counts document observed evidence for adapter behavior; they are not runtime constants and must never be hard-coded.