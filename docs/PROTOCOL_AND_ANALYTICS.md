# Protocol and Analytics

This document distinguishes fixture-confirmed protocol data from product decisions. Do not silently infer unsupported fields.

## 1. Minimum inbound events

```text
combat.started
loot.received
capture.success
capture.failed
hunt.stopped
hunt.analyzer_reset
```

Ignore unrelated frames early and do not persist full WebSocket frames.

## 2. `combat.started`

Extract when present:

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
session.id
session.auto_capture
```

The game `session.id` is metadata (`serverSessionId`), not the local `session_id`.
`session.summary` is cumulative; do not sum snapshots as incremental rewards.

## 3. `loot.received`

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
```

Primary encounter cycle:

```text
cycle_ms = loot.ts - combat.started.ts
```

UI label: `Target Cycle`. Do not call it pure combat time.

## 4. `capture.failed`

Extract:

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

## 5. `capture.success`

Extract when present:

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
creature.quality
creature.is_shiny
creature.ivs
```

Do not use `creature.level` as target level. Keep the target level captured at `combat.started`.
`auto_sold = true` is still a successful capture.

## 6. Correlation

Temporary lookup:

```javascript
activeByWildMonsterId.set(wildMonsterId, encounterId)
```

Expected flow:

```text
combat.started
      ↓
   STARTED
      ↓
loot.received
      ↓
    LOOTED
   ↙      ↘
success  failed
```

Do not remove correlation at `loot.received` if a later capture result still needs to attach.

Finalize/remove on capture result, wild-id reuse by a new `combat.started`, or conservative stale timeout.

## 7. Wild-id reuse and orphans

A new start with a reused wild id creates a new `encounter_id`.
Do not force orphan events onto old encounters just because the wild id matches.
Useful orphan data may be stored with `state = orphan` and excluded from metrics requiring reliable `cycle_ms`.

## 8. Dedupe and reconnection

Assign a local `socketId` to each observed WebSocket instance.
Recommended dedupe identity:

```text
socketId | eventType | seq
```

Do not treat `seq` as globally unique; it may restart after reconnection.

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
Dollar/h      = Σ gold / active_hours
```

If active time is zero, display `—`.

Capture rates:

```text
Seen → Capture = captured / seen
Attempt Rate   = captured / (captured + failed)
```

Rare+ is `rare + epic + legendary + mythical`.
Track shiny `seen`, `captured`, `failed`.

## 11. Group analytics

Do not assign the entire session time to every `group_key`.

```text
group_cycle_ms = Σ encounter.cycle_ms
Trainer EXP / Cycle Hour = Σ trainer_exp / (group_cycle_ms / 3600000)
Dollar / Cycle Hour      = Σ gold / (group_cycle_ms / 3600000)
```

UI must distinguish `Session EXP/h` from `Cycle EXP/h`.

## 12. Reference fixture baseline

Known event counts:

```text
combat.started       1,359
loot.received        1,631
capture.failed       1,262
capture.success         58
hunt.analyzer_reset      8
hunt.stopped             6
```

Known failed-capture rarity counts:

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

The fixture also contains wild-id reuse and orphan events. Do not hard-code a final normalized encounter count until correlation rules are covered by tests.
