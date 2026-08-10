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
enemy.elements
enemy.gender
enemy.nature
enemy.quality_multiplier
session.id
session.auto_capture
```

`enemy.elements` (array of strings), `enemy.gender` and `enemy.nature`
are confirmed straight from a real capture
(`combat.started.data.enemy`, Fase 4). `elements` is the only one of the
three used for anything beyond display (a Compare filter); the game's
own observed values populate that filter, not a hardcoded element list.

`enemy.quality_multiplier` is a continuous quality score (e.g. `1.02`),
confirmed in a real capture — distinct from the discrete `quality` tier
(`weak`/`common`/.../`mythical`), which the UI calls "Rarity". Current's
"Captured" list (§10) filters on it. `enemy.ivs`'s 6 individual stats
(`hp`/`atk`/`def`/`spa`/`spd`/`spe`) are now persisted individually too,
not just summed into `ivTotal` (`domain/ivTotal.js` still does the sum;
the raw per-stat object is kept alongside it for that same list). Both
are combat.started-only — `capture.failed` doesn't carry either at all,
same non-overwrite policy as `level`/`quality`/`elements`/`gender`/
`nature`.

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
auto_potion_used
supply_cost
```

Primary encounter cycle:

```text
cycle_ms = loot.ts - combat.started.ts
```

UI label: `Target Cycle`. Do not call it pure combat time.

`loot.received` has a second, mutually exclusive shape: the game
auto-drinking a potion mid-fight. Confirmed across real captures (3,522
`loot.received` events, ~29% of them this shape): it has **no
`wild_monster_id`** at all, just `auto_potion_used` (a move id string,
e.g. `"potion_ultra"`) and `supply_cost` (the potion's real cost — same
field name the protocol reuses on `capture.failed`/`capture.success` for
the capsule cost). The two shapes never mix on the same message. This
variant is a trainer-wide expense, not tied to any specific wild
encounter — it never becomes an encounter row (see §7).

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

The captured creature also carries `elements`, `gender`, `nature` and
`quality_multiplier` (confirmed in a real capture) — none of these are
extracted. Same reasoning as `creature.level`: the captured individual
is not necessarily the same as the target snapshotted at
`combat.started` (its own `level` already proves that), so nothing
about it overwrites that snapshot. `creature.quality`/`creature.ivs` ARE
extracted above but, for the same reason, never used to patch an
encounter row (`domain/encounterTracker.js`'s `applyCaptureResult`).
`combat.started.data.enemy.elements/gender/nature/quality_multiplier/ivs`
(§2) is the only source for those fields.

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

A new start with a **genuinely different** individual on a reused wild id
creates a new `encounter_id`. Do not force orphan events onto old
encounters just because the wild id matches.
Useful orphan data may be stored with `state = orphan` and excluded from metrics requiring reliable `cycle_ms`.

**Not every `combat.started` on an already-tracked wild id is reuse.**
Confirmed against a real backup: the game sometimes re-announces the
exact same individual (identical `species_id`/`level`/`quality`/
`gender`/`nature`/`ivs`/`quality_multiplier`) more than once for the
same real encounter — likely a resend/resync the `seq` dedupe (§8)
doesn't catch, since it's keyed on `socketId|type|seq`, not content.
Treating every re-announcement as "the old one is abandoned" finalized
the real encounter as `incomplete` and created a duplicate that then
stole the actual loot/capture result — a real bug, confirmed at ~36% of
all persisted encounters in one real backup (99.4% of the resulting
`incomplete` rows were the same individual re-announcing, not a new
spawn). Compare the full individual fingerprint before finalizing: if
it matches, it's the same encounter — just refresh `updatedAtMs`, don't
finalize or create anything.

**Exception — not every unmatched `loot.received` is an orphan.** The
auto-potion-used variant (§3) has no `wild_monster_id` on purpose; it is
never routed through the orphan path. Doing so used to create a bogus,
all-null orphan encounter row for every single auto-potion use — a real
bug, since it happens on a large fraction of `loot.received` traffic.
That signal now only updates the session's expense counters (§10),
creating no encounter row at all.

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
Dollar/h      = Σ (gold + (auto_sold ? auto_sell_value : 0)) / active_hours
```

`Dollar/h` counts both the wild monster's own `loot.received.gold` drop
AND, when a captured Pokémon was auto-sold, its `auto_sell_value` — both
are real, realized income during the Hunt.

If active time is zero, display `—`.

**`Seen` is an exact identity, not an independent count:**

```text
Seen = Captured + Failed
```

A Pokémon only counts as "seen" if a capture was actually attempted
against it. A `combat.started` that never got a capture attempt (the
player farmed EXP/gold and moved on, or the encounter is
unresolved/incomplete) is NOT seen — it may have just shown up in the raw
log without real battle interaction. This also means an `orphan` row
CAN be "seen" if it still carries a real capture attempt.

Capture rates:

```text
Seen → Capture = captured / seen
Attempt Rate   = captured / (captured + failed)
```

Rare+ is `rare + epic + legendary + mythical`.

Track shiny `seen`/`captured`/`failed` per rarity tier too
(`shinySeen`/`shinyCaptured`/`shinyFailed` — an annotation, always a
subset already counted in the tier's plain `seen`/`captured`/`failed`,
never additive), not just the single cross-tier total. Current's By
Rarity table (docs/ARCHITECTURE.md §12 — there is no separate Shiny
section) renders it as `"Qty (ShinyQty)"`.

**Gastos/h (Hunt expenses):**

```text
Gastos/h = (Σ encounter.supply_cost [Pokébolas] + session.potionsCost [Potions]) / active_hours
```

Pokébolas cost is per-encounter (`supply_cost` on any capture attempt,
already real protocol data). Potions cost is accumulated on the
**session**, not the encounter — the auto-potion-used signal (§3) has no
`wild_monster_id` to attribute it to. `session.potionsUsed` (a raw
count) is shown alongside it; there is no per-potion price breakdown by
type, just the total `supply_cost` the protocol actually reports.

## 11. Group analytics

Do not assign the entire session time to every `group_key`.

```text
group_cycle_ms = Σ encounter.cycle_ms
Trainer EXP / Cycle Hour = Σ trainer_exp / (group_cycle_ms / 3600000)
Dollar / Cycle Hour      = Σ (gold + (auto_sold ? auto_sell_value : 0)) / (group_cycle_ms / 3600000)
```

UI must distinguish `Session EXP/h` from `Cycle EXP/h`. Same auto-sell
rule as §10's `Dollar/h`.

No group-level Gastos: potion expenses are session-scoped, not
`group_key`-scoped (§10) — attributing them to one species+level+config
group would mean inventing a split the protocol doesn't provide.

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
