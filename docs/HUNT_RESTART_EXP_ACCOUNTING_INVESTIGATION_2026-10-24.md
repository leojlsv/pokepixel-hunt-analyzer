# Hunt restart EXP accounting — local investigation

Date: 2026-10-24 (Brasilia time) / 2026-10-25 UTC.
Scope: isolated `prep/v1.15.11-bounded-performance` worktree, carrying the
new local `v1.15.12` candidate, **not installed or published**.

## Report and boundary

The player reports intermittent EXP not counted after restarting a Hunt in
place; returning to town, restarting and reentering appears to recover it.
It is not yet established whether the missing EXP belongs to the **game**
or to the **Analyzer**, nor whether it is Trainer EXP, Pokemon EXP, rate/h
or totals. The Analyzer reads observed server events; it cannot award game EXP.
No live authenticated WebSocket trace, account IndexedDB or real Hunt was
accessed or modified during this investigation.

## Reproduced causal failures — before the patch

Disposable `fake-indexeddb` tests independently exercise adapter →
eventPipeline → IndexedDB → `computeSessionMetrics`.

1. **Recycled transport ID after in-place reset**: with A pending kill seq 1
   and B new kill seq 2, both under `session_id=s` in the same zone,
   `adaptAggregatedLoot` selected `retiredHunts` for the entire reward
   frame. B's seq 2 did not exist there; the adapter emitted zero canonical
   rewards and the positive Trainer/Pokemon EXP never reached IndexedDB.
2. **Recycled raw and kill sequence on the same WebSocket**: after A
   completed, B reused raw seq and kill seq. The pipeline's old
   `socketId|type|seq` dedupe incorrectly labeled B's new synthetic
   `combat.started` as a duplicate, then rejected B's new reward.
3. **Overlapping old/new pending kills with the same transport ID and
   kill seq**: a reward has no authoritative generation. Prior code
   selected A and could mutate its encounter with B's reward.
4. **Control**: A→city/new server ID→B with a late A reward correctly
   patched A, not B. This control passed before the patch.

Initial red run: 4 tests; 1 passed, 3 failed as above.

## Local patch

- `userscript/protocol-adapter.js`: local monotonic correlation generation
  advances on rotation **after a kill was observed** (not on the initial
  reset + metadata announcement pair). A session-only `combat.started`
  with unchanged ID/zone is treated as a reannouncement, not a new run.
- New synthetic encounters in subsequent generations receive distinct
  `wildMonsterId` suffixes (`:gN`); canonical synthetic starts, rewards,
  closes and matched terminals carry the generation from their **own**
  kill context, including delayed older-generation rewards.
- `services/eventPipeline.js` uses the generation when present in
  deduplication; legacy unscoped event identity is unchanged.
  `userscript/main.js` explicitly forwards the field from observer
  to pipeline. No registry flush or dedupe-limit increase was introduced.
- Per-kill retired lookup no longer overrides positive evidence of a
  distinct active kill just because its `session_id` was recycled.
  Ambiguous same-ID/missing-origin rewards and cross-generation terminal
  matches fail closed rather than corrupting the earlier/current encounter.
  When `loot.received` omits `session_id`, correlation considers every
  retained older run; the absence of this optional source ID does not imply
  that the reward belongs to the active generation.
- A bounded temporary cache (at most 256 frame identities, capped at
  4,096 characters each and 60-second default retention) blocks a
  **raw-equivalent old reward-frame replay** from poisoning a new
  generation that reused server session/kill/raw sequence. Frame identity
  incorporates original server `seq`, `ts`, optional transport ID
  (including explicit null when absent), and reward body; identical EXP
  alone is never treated as a replay. Bounded shape preflight avoids
  serializing arbitrarily large/deep raw reward metadata; oversized
  frames still process normally but lack exact replay-cache protection.
  This cache is independent of the pipeline's post-persistence dedupe
  and cannot replace server IDs.
- Scalar ambiguity counts are exposed through WebSocket observer status:
  `adapterAmbiguousLootEntriesDropped`,
  `adapterUncorrelatedRecycledLootEntriesDropped`,
  `adapterAmbiguousTerminalEventsDropped` and
  `adapterReplayedLootFramesDropped`, plus
  `adapterUnfingerprintableLootFrames`. The adapter's read-only
  `getDiagnosticsSnapshot()` is O(1), without copying full contexts.

No call to `forceNewSession`, `New Hunt`, `Reset Hunt`, history deletion,
IndexedDB wipe, automated town travel, checkpoint V5, or schema migration.
Current/History pagination and 120-second hidden-view memory eviction
were not modified.

## Important unresolved protocol ambiguity

When the server recycles **both** a transport `session_id` and kill
`seq`, and an old reward or terminal arrives after a restart without a
server-authoritative run generation, the client cannot always establish
which run owns the packet. A missing B knockout does not prove the packet
belongs to A, and an overlapping species/zone/event ID is not authoritative.

The patch deliberately declines uncertain attribution. This protects
per-encounter correctness but can **undercount ambiguous EXP/captures**;
it is not an unconditional fix for every restart sequence. Completion
would require the game server to attach an immutable run/kill identity
to each reward and terminal, or a trustworthy authoritative replay source.
No inferred EXP is inserted, no `hunt.kill_reward` fallback is enabled,
and no old session is silently merged into a new one.

Remaining caveat: the bounded cache protects previously emitted raw frames
with matching identity that are still remembered, even without
`session_id`. It cannot detect every semantically equivalent replay
with changed timestamp/shape, expired memory, unsupported shape or oversized
frames. Its identity is recorded when the adapter *emits* a reward, before
the asynchronous IndexedDB transaction acknowledges persistence. A source
event that failed to persist before an overlapping Hunt restart may still
require server-side replay/provenance to recover safely. The pipeline
still guarantees per-generation dedupe; general source-wide idempotency
and completely lossless ambiguous attribution require an authoritative
source event ID/run identity.

## Regression cases

Tests in `tests/integration/huntRestartExpAccounting.test.js` cover
recycled IDs, same/new socket, monotonic/restarted sequences, exact old
raw-frame replay with or without `session_id` before the true new reward,
an unseen delayed old reward without `session_id`, bounded cache aging,
oversized/unserializable metadata preflight, late loot
with a distinct server ID, same-generation replay, collision fail-closed,
same-session metadata reannouncement, overlapping terminal, unknown
source identity, totals and separate Trainer/Pokemon EXP. Observer tests
verify read-only ambiguity counters.

Existing Expedition/legacy HuntSim/pipeline tests are still necessary
because rewards can arrive after terminal capture and older sessions must
never be replaced by current-run data.

## Field diagnosis, without accessing real data

If the issue recurs in normal use, compare **the game's actual EXP gain**
with the Analyzer totals and rates. To isolate the Analyzer boundary,
inspect a sanitized raw `loot.received.data.per_kill` value, its
canonical `loot.received` output, the pipeline's accepted/duplicate
result, the corresponding persisted encounter and the recomputed
`computeSessionMetrics`. Check observer ambiguity counters separately.

- No positive server EXP received: cannot infer an Analyzer accounting bug.
- Positive raw EXP with no canonical reward: adapter drop/ambiguity.
- Canonical output marked duplicate: check source/restart dedupe scope.
- Persisted encounter correct but Current/HUD stale: reconciliation/UI issue.

Synthetic tests prove the conditional failure paths, **not** that the real
server uses this exact recycled-ID sequence or that the game's own EXP
granting failed. Real validation of a same-zone restart is still pending.

## Historical 2026-10-25 local gate / candidate artifacts

The EXP fix is now versioned as **v1.15.12, local unpublished candidate**.
The existing worktree and branch retain their original `v1.15.11` staging
names only to preserve their history; no Git rename or commit was performed.
This candidate combines the v1.15.11 bounded-performance improvements with
the EXP restart corrections. The older v1.15.11 review's 662-test count,
module provenance and bundle SHA-256 are historical, not current.

This gate **predates the 2026-10-26 Card Mode integration correction**. After
the restart-EXP changes and raw replay guard, including optional
`session_id` and missing-origin late first rewards:

- `npm run validate`: **677 tests passed, 0 failed**.
- PROD bundle built; userscript metadata/update-invariant verification PASS.
- `npm run audit:deps`: **0 vulnerabilities**.
- `git diff --check`: exit 0; a pre-existing LF/CRLF warning is not a failure.
- New regressions independently reproduced 3 adapter/dedupe failures,
  exact old-frame replay with and without `session_id`, and an unseen
  delayed old reward without source ID before their respective fixes.
- Independent read-only focal review of the final patch: **0 newly
  confirmed P0/P1/material P2**, subject to the known upstream provenance
  limitation and the source-only scope of that review.
- No game authentication, installation, IndexedDB mutation of user data,
  staging, commit, push, merge or release occurred.

Historical local bundles, **not approved for installation/publication**:

```text
dist/pokepixel-hunt-analyzer.user.js
  v1.15.12 PROD
  SHA-256 DF6C165C21661B64D0D1A0770D69394493597245D0BFF758F634023CC04451C5

dist/pokepixel-hunt-analyzer-v1.15.12-expfix-dev.user.js
  v1.15.12-dev, separate development metadata
  SHA-256 468761F3EB3B32DE4DC84A0145B9DB68282343CFD571467C1685BC44B7BD61D3
```

The earlier `dist/pokepixel-hunt-analyzer-v1.15.11-dev.user.js` was
preserved as a historical build and does **not** include this EXP patch.
DEV `v1.15.12` is a separately copied build that matches only the
development game URL and has no production update URLs. PROD metadata and
bundle were rebuilt afterward and reverified. No prior v1.15.11 binary
was installed or published during this work.

This validation does not prove game-side EXP granting or long-term FPS at
102 hours. Before any publication, compare behavior under a normal
same-zone restart against the actual game UI and server events, then give
the corrected candidate a newer version than any version already published.

## 2026-10-26 addendum — Reset via Better UI Card Mode

New field information identifies the triggering gesture precisely: **Resetar
inside Better UI Card Mode**, not the native game's Hunt reset. Source trace:
`Better UI cards.js` → `runAnalyzerSessionAction("reset")` →
`__POKEPIXEL_HUNT_ANALYZER_CONTROL__.act("reset")` →
`Analyzer main.js handleSessionAction("reset")` →
`forceNewSession({ startPaused: true })`.

The old contract created a new Analytics Hunt `paused+locked`, even though
the native game kept hunting. Subsequent valid rewards could be persisted but
the paused session clock remained zero; therefore `trainerExpPerHour` and
`pokemonExpPerHour` were null until explicit Resume. Rewards from an encounter
that started **before** Reset remained on its original history session and did
not appear in the new Current summary. Neither behavior demonstrates loss of
EXP actually awarded by the game.

The v1.15.12 candidate now extends the existing **protocol-1** public control
with the frozen `capabilities.resetRunning = true` and allowlisted
`act("reset-running")`. The latter uses the existing local
`forceNewSession()` transition to start a new `running+unlocked` session
atomically; it does not invoke any PokePixel gameplay or server reset. The
legacy `act("reset")` **still** creates a paused/locked session for backward
compatibility. The Better UI v0.2.216 candidate calls the new action when
resetting an active Card Mode session, preserves deliberate manual pause, and
falls back to awaited Reset→Resume when an older Analyzer lacks the capability.

Late pre-reset rewards are not migrated arbitrarily. A deterministic
`fake-indexeddb` fixture validates E1 late 50 EXP in old History and E2
200 EXP in the new running Current, with active clock and finite EXP/h.
Another regression executes the **actual embedded userscript bundle** and
its real public bridge with a synthetic WebSocket, covering the same
transition end to end without a real account or persistent user database.
No change was made to the game's native Pokémon EXP bar, which reads Team HUD
state independently of Analyzer summaries.

Both local implementations remain **uninstalled, uncommitted and unpublished**.
The old hashes above are historical; the post-Card-Mode build and final gate
are recorded separately below.

### Gate final do complemento Card Mode (2026-10-26)

- Analyzer `npm run validate`: **679/679 PASS**. Inclui teste do
  bundle real embedded em `happy-dom`, com API pública e WebSocket
  sintético; garante B EXP=200, EXP/h ativo, A tardio EXP=50 no histórico.
- `npm run audit:deps`: **0 vulnerabilidades**.
- PROD build e `npm run verify:userscript`: **PASS**, v1.15.12.
- DEV build isolada: v1.15.12-dev, namespace e match de
  desenvolvimento, sem URLs de atualização de produção.
- Better UI local cumulativo `v0.2.216`: **1.152/1.152 PASS** no
  `npm run validate` (testes + build).
- Revisão independente read-only do escopo Card Mode: **0 P0/P1/P2
  novos** após a correção do caso de exceção na interface.
- `git diff --check` nos dois projetos: PASS, exceto aviso informativo
  de LF/CRLF preexistente em `closed-hud-runtime.js`.

Artefatos atuais **somente locais e não aprovados para publicação**:

```text
G:/pokepixel-hunt-analyzer/.worktrees/release-v11511-bounded-candidate/dist/pokepixel-hunt-analyzer.user.js
  PROD v1.15.12
  SHA256 AF77FA2AD28D873595BCD41BFE0BBF22AFF46FA155652A6F96CA4AC50F2C6361

G:/pokepixel-hunt-analyzer/.worktrees/release-v11511-bounded-candidate/dist/pokepixel-hunt-analyzer-v1.15.12-card-reset-dev.user.js
  DEV v1.15.12-dev
  SHA256 240D8F2F7199E958F52FECFF79EE33F6F3FACE9E8BB4644FB615148115AF0692

G:/pokepixel-better-ui/work/professions-card-mode-0.2.216/dist/pokepixel-better-ui.user.js
  Better UI local cumulativo v0.2.216
  SHA256 B15A6D1C21A7B80EA8633422ABA59AAF4EFD7A745E6D507AC574B4F8406221AA
```

O Better UI mantém em seu lockfile a dependência **dev-only** `undici@8.11.2`,
trazida por `jsdom@30.0.1`, com advisories de alta severidade no
`npm audit` completo. O `npm audit --omit=dev --audit-level=high`
retornou **0 vulnerabilidades de produção**. Não houve atualização
genérica de dependências de teste neste corretivo; resolver o advisory
antes de um futuro gate integral de release é uma tarefa separada.

**Aceite funcional informado pelo Product Owner (2026-10-26T18:10:27Z):**
após o teste do corretivo relacionado ao Reset via Better UI Card Mode,
declarou **"Validado"** e relatou **ausência de travamentos e drops de FPS
até aquele momento**. Isso confirma a observação de funcionamento in-game
declarada pelo Owner; não demonstra uma prova de longa duração de 102 horas,
nem identifica independentemente o SHA exato que estava instalado no
navegador. Também não constitui autorização de commit, merge, push, tag ou
publicação. O campo de EXP tardia do encontro iniciado antes do Reset
permanece associado à Hunt anterior.

**Próxima etapa:** preparar pacote/PR de integração da v1.15.12 a partir
de fonte isolada e revisável, reconciliando esta worktree não commitada com
`origin/main`; repetir gates em checkout limpo (inclusive Linux/CI),
verificar versão pública atual, metadados e artefatos. Apenas depois da
revisão e de autorização expressa realizar a publicação pelo workflow
`publish/vX.Y.Z`, derivado do `main` já integrado.
