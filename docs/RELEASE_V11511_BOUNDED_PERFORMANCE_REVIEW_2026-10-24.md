# PokePixel Hunt Analyzer — v1.15.11 local release-candidate review

> **Historical baseline review (before the restart-EXP patch).**
> The local candidate was subsequently edited on 2026-10-25 UTC for
> restart/recycled-session EXP accounting, with additional source and tests.
> The 662-test count, original PROD/DEV SHA-256 values, source equivalence
> and provenance manifest below refer to the **earlier candidate**, not the
> latest working tree. See
> `HUNT_RESTART_EXP_ACCOUNTING_INVESTIGATION_2026-10-24.md` for changes,
> constraints, current gate results and final bundle hash.

**Status: prepared for source review; NOT approved to publish.**
Date: 2026-10-24. No authenticated game or personal browser/IndexedDB was
accessed. No Tampermonkey installation, automated Hunt reset, commit,
push, merge or release publication was performed.

## Provenance and isolation

| Item | Verified local value |
|---|---|
| Clean base | v1.15.8, Git `2624e75` |
| Release-prep worktree | `.worktrees/release-v11511-bounded-candidate` |
| Local branch (uncommitted) | `prep/v1.15.11-bounded-performance` |
| Candidate package version | `1.15.11` in package and lock |
| Previous performance WIP | `.worktrees/perf-long-hunt-102h`, local v1.15.10 |
| Runtime source graph | 111 imported modules |
| Imported experimental V5 runtime | **0 modules** |
| Deliberate WIP runtime-source difference | `userscript/protocol-adapter.js` only |

The prior performance WIP contained hundreds of extra investigative assets,
including unready V5 durable writer, source-certification and cutover modules.
The new worktree was created from the **clean v1.15.8 commit**, not by
publishing that dirty WIP. Only 28 production-module files and 26 pertinent
test files were selectively ported. Three disposable test/benchmark fixtures
were also copied; **no** `data/experimental-v5-*` module was imported or
added to the production runtime.

The 111-module production graph was independently compared file by file to
the previous locally tested v1.15.10 WIP, normalizing CRLF/LF. All 110
non-checkpoint modules match semantically. The *only* difference is that
v1.15.11 retains the default v1.15.8 `protocol-adapter.js` instead of the
WIP's opt-in `experimentalCheckpointAccess` export/restore operations;
normal `adapt()` and `snapshot()` behavior is unchanged. See the pinned
per-module SHA manifest in `RELEASE_V11511_SOURCE_PROVENANCE_2026-10-24.json`.

For a future reviewed source-only change list, use
`RELEASE_V11511_STAGING_MANIFEST_2026-10-24.json`. It lists runtime files,
tests, scripts, and documentation that belong to the candidate while
explicitly excluding temporary `.tmp` run logs, node_modules and any V5
experimental modules. **Nothing is Git-staged or committed by this manifest.**

The candidate intentionally retains the coherent production hot-path
`main.js` / `eventPipeline.js` / `encountersRepository.js` /
`encounter-revision.js` before/after transition chain, plus IDB blocked-open
hardening, Closed HUD lifecycle form observer, and relevant measurements.
The atomic before/after repository API is not mixed with the older pipeline.
These are **production changes**, not a safe-to-publish claim: an authenticated
smoke test should still verify all cross-tab/write paths before any release.

Independent **strict read-only** source QA compared the candidate with
the clean 1.15.8 base and the previous 1.15.10 WIP. It found **no newly
confirmed material P0/P1/P2** within the examined runtime and provenance
scope. The reviewer checked the coupled repository/pipeline before/after
transactions, browser leadership and cleanup fences, Current/History bounded
pages, 120-second suspension, Closed HUD one-column lifecycle and Catch Chance
preferences. This was a source-only review, separate from the automated and
native tests below. Critically, the encounter-revision marker only tracks
**cooperating** writers: it is *not* a global cross-tab server-proof or a
replacement for legacy/raw-writer full-source reconciliation.

## Verification completed locally

| Gate | Result |
|---|---|
| `npm ci` (baseline lock), then upgrade dev-only happy-dom | Completed |
| `npm run validate` with `happy-dom@21.0.4` | **662/662 PASS** |
| Local bundle build + metadata/update invariants | PASS, v1.15.11 |
| `npm run audit:deps` (including development tools) | **0 vulnerabilities** |
| Chromium actual modules/CSS, 320/390/400/415/620 px | **5/5 PASS** |
| Native UI assertions | 31/31 each mobile, 27/27 each desktop |
| Deep pagination, focus, six-digit jump and Catch Chance precision | PASS |
| Native captured=10/failed=0 single-page bars hidden | PASS |
| Full 24,480 and 91,800 synthetic encounter sources | Both retained, PASS |
| Bounded DOM at either source size | Current <=200 combined, History <=100 |
| Hidden 120-second UI cache memory relief | Both synthetic cases PASS |

`happy-dom@21.0.4` is a **test-only major dependency update**. No browser
runtime library was added to the userscript. Its compatibility was checked
by rerunning the full candidate suite; this candidate contains fewer tests
than the old WIP because the test-only V5 experiments were deliberately
excluded. Thus 662/662 and 1,184/1,184 are not comparable suite sizes.

Local native evidence:
`PERFORMANCE_V11511_NATIVE_2026-10-24.json` plus 15 Chromium screenshots
in `docs/evidence/v11511-native-pager/`. Native rendering uses a disposable
Chrome profile and local loopback HTML; it does not use the authenticated game.
Other synthetic evidence:
`PERFORMANCE_V11511_BOUNDED_2026-10-24.json` and
`PERFORMANCE_V11511_HIDDEN_2026-10-24.json`.

## Candidate bundles — NOT installed

- Production-variant local candidate:
  `dist/pokepixel-hunt-analyzer.user.js` v1.15.11,
  SHA-256 `B51047186B9C6B276792E35D3A6989E7AD8908FEDCCC9F823FF3575A939CB7AC`.
  Its metadata includes normal production update URLs; it has not been
  installed, published or pushed.
- Distinct development-only candidate:
  `dist/pokepixel-hunt-analyzer-v1.15.11-dev.user.js` v1.15.11-dev,
  SHA-256 `FA7AFE12D7544C8C10EA9694169A0CCC23C9AD0B39295383802C309ED8DAC726`.
  It has no production update URLs, a distinct name/namespace and matches
  only `https://dev.pokepixel.nietore.com/*`.

## Field observation and limitations

The user previously observed approximately **7h and 10,000 Seen** with no
noticeable FPS drop in a long Hunt. The exact installed script bytes were
not independently identified; this is *supportive field evidence for the
mitigation*, not direct acceptance testing of the new v1.15.11 bundle.
Keeping a Hunt open for 102h is no longer practical and is not required.

The original 102h FPS cause remains unproven. The main runtime still holds
full canonical encounter arrays/ID maps; a standby/refresh reconciliation
can retain O(N) costs. A fixed DOM cap does not imply bounded total heap,
IndexedDB storage, GC duration or all-game FPS. The tests are deterministic
synthetic regression checks, not an end-to-end 102h game trace.

## Decision and last approval gate

**GO:** keep this isolated local v1.15.11 source/bundle available for
code review and manual functional acceptance. The source graph has no
experimental V5 cutover, the test/dependency gates are clean, and existing
worktrees have not been modified.

**NO-GO for automatic/public release:** the 1.15.11 candidate has not been
installed or exercised in the authenticated game. Before publication,
the owner should approve the concrete diff and separately authorize the
release action. Verify exact version already installed/available upstream,
then smoke-test the bundle's Hunt continuity, Current filters/pagination,
late raw-writer corrections, History/Loaded Attempts, Loot, Card/Closed HUD,
cross-tab leadership, Catch Gallery and the 120-second cold rehydration.
Confirm the update/rollback path before any install, commit, merge, tag,
push or public release.

**Do not** change the player's Hunt boundaries, auto-rotate or reset Hunts,
delete IndexedDB, or run a forced 102h test as a release prerequisite.
