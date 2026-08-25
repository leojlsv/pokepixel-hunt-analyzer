import json
from pathlib import Path

VERSION = "1.9.0"
DATE = "2026-08-25"


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Expected text not found for {label}")
    return text.replace(old, new, 1)


# package.json: version source of truth + explicit DEV build target.
package_path = Path("package.json")
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = VERSION
scripts = package.setdefault("scripts", {})
ordered = {}
for key, value in scripts.items():
    ordered[key] = value
    if key == "build:userscript":
        ordered["build:userscript:dev"] = "node scripts/build-userscript.mjs --dev"
if "build:userscript:dev" not in ordered:
    ordered["build:userscript:dev"] = "node scripts/build-userscript.mjs --dev"
package["scripts"] = ordered
package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

# Production is the default build. DEV remains explicit and isolated.
write(
    "scripts/build-userscript.mjs",
    '''import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageUrl = new URL("../package.json", import.meta.url);
const entryUrl = new URL("../userscript/main.js", import.meta.url);
const distDirUrl = new URL("../dist/", import.meta.url);
const outputUrl = new URL("../dist/pokepixel-hunt-analyzer.user.js", import.meta.url);

const pkg = JSON.parse(await readFile(packageUrl, "utf8"));
const isDevBuild = process.argv.includes("--dev");
const appVersion = isDevBuild ? `${pkg.version}-dev` : pkg.version;
const metadata = `// ==UserScript==
// @name         ${isDevBuild ? "PokePixel Hunt Analyzer DEV" : "PokePixel Hunt Analyzer"}
// @namespace    ${isDevBuild ? "https://github.com/leojlsv/pokepixel-hunt-analyzer/dev" : "https://github.com/leojlsv/pokepixel-analyzer-sidepanel"}
// @version      ${appVersion}
// @description  ${isDevBuild ? "DEV-only HuntSim compatibility build for PokePixel Hunt Analyzer." : "Passive Hunt analytics for PokePixel. Current, History and local tools."}
// @author       Rhyxus
// @license      MIT
// @match        ${isDevBuild ? "https://dev.pokepixel.nietore.com/*" : "https://pokepixel.nietore.com/*"}
// @run-at       document-start
// @sandbox      raw
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      img.pokemondb.net
// ==/UserScript==`;

await mkdir(fileURLToPath(distDirUrl), { recursive: true });

await build({
  entryPoints: [fileURLToPath(entryUrl)],
  outfile: fileURLToPath(outputUrl),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome114", "firefox128"],
  legalComments: "none",
  minify: false,
  sourcemap: false,
  loader: {
    ".png": "dataurl"
  },
  banner: { js: metadata },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    "process.env.NODE_ENV": '"production"'
  }
});

console.log(`Built dist/pokepixel-hunt-analyzer.user.js v${appVersion} (${isDevBuild ? "DEV" : "PROD"})`);
''',
)

# CHANGELOG: prepend v1.9.0 without touching historical entries.
changelog = read("CHANGELOG.md")
marker = "The project follows Semantic Versioning.\n"
if "## [1.9.0]" not in changelog:
    section = f'''\n## [1.9.0] - {DATE}

### HuntSim protocol compatibility
- Added a protocol adapter between the passive WebSocket observer and the existing canonical event pipeline.
- Added HuntSim full-frame entity decoding and kill-sequence correlation across `hunt.frame`, `hunt.capture_queue`, `hunt.events`, terminal `capture.*` events and aggregated `loot.received.per_kill[]` rewards.
- Added synthetic HuntSim correlation ids while preserving legacy `wild_monster_id` behavior and the existing IndexedDB/domain model.
- Added support for HuntSim terminal-before-loot ordering so late rewards patch the same persisted encounter instead of creating duplicates.
- Explicitly ignores duplicate HuntSim reward/capture projections (`hunt.kill_reward`, `hunt.rewards`, capture projections inside `hunt.events`) to prevent double counting.
- Legacy PROD event flow remains supported unchanged.

### Capture data correctness
- Successful HuntSim captures now preserve authoritative `creature` metadata: Rarity, Shiny, IV breakdown/total, Gender, Nature, Elements, Quality Multiplier and Captured By.
- Unmatched `capture.success` events retain terminal creature metadata instead of persisting mostly-empty orphan rows.
- `capture.success.creature.level` remains intentionally excluded as target level because the captured creature can be rebased independently from the hunted target.
- Failed HuntSim captures preserve the fields actually exposed by the protocol: Rarity, Shiny, IV Total, Capsule, Chance and target Level; unavailable Gender/Nature/full IV breakdown/Elements/Quality Multiplier remain null rather than inferred.
- Aggregated HuntSim loot is split into one canonical reward event per kill while preserving global XP/Gold totals.
- Added nested `creature.captured_by_name` fallback used by Capture Ticket eligibility.

### Current / History UI
- Simplified Current > Failed to `Pokémon | IV | Pokéball | Fled at` with values visible directly in the table; removed the Failed Quality filter and row detail expansion.
- Reordered Captured IV breakdown to `HP · Atk · sAtk · Def · sDef · SpD` and exposed that order in the column header for visual validation.
- Replaced History Attempts/Notables `Qlt` with `Ball`, which is authoritative for both successful and failed attempts under HuntSim.
- Collapsing Hunt XP metrics now keeps the current Pokémon label and Hunt status visible.

### Capture Ticket / Catch Gallery
- Fixed `Generate` preview mounting so the dialog owns the viewport/z-index and opens reliably from Catch Gallery.
- Standardized Pokémon sprite rendering on a 192×192 useful area: the complete source PNG canvas is fitted as the `1x` baseline, centered/clipped to the area, rendered with Canvas smoothing disabled and previewed with pixelated image rendering.
- Preserved `Generate`, PNG download and `Copy` behavior with the existing metadata/fingerprint pipeline.

### Build / release hygiene
- Bumped application version to `1.9.0` in `package.json` and `package-lock.json`.
- Restored the default userscript build to the production identity/domain and preserved the historical production namespace for Tampermonkey update continuity.
- Added `npm run build:userscript:dev` as an explicit DEV-only build targeting `dev.pokepixel.nietore.com`, so future protocol smoke tests no longer require mutating release metadata.
- Updated README and technical documentation for the dual legacy/HuntSim protocol boundary and the v1.9 UI/runtime behavior.

### Validation
- 255 automated tests passing with zero failures.
- Dependency audit reports 0 vulnerabilities.
- Legacy 4000+ fixture replay preserves 4,128 persisted encounter rows.
- HuntSim unit/integration coverage validates correlation, successful/failed terminal events, late loot and unmatched-success persistence.
- Manual DEV smoke validated Hunt metrics, rarity counts, capture details, Catch Gallery Generate/Copy, Capture Ticket pixel rendering and the Current/History UI refinements.
'''
    changelog = replace_once(changelog, marker, marker + section, "CHANGELOG header")
    write("CHANGELOG.md", changelog)

# README: v1.9 product surface and protocol architecture.
readme = read("README.md")
readme = replace_once(readme, "**Versão:** `v1.8.0`", "**Versão:** `v1.9.0`", "README version")
readme = replace_once(
    readme,
    "- listas de Captured e Failed;\n- filtros por Rarity, Shiny, Quality e IV;\n- detalhes de captura/tentativa, Capsule, timestamp e Chance quando disponível.",
    "- listas de Captured e Failed;\n- Captured com filtros por Rarity, Shiny, Quality e IV;\n- Failed com filtros por Rarity, Shiny e IV e colunas diretas `Pokémon | IV | Pokéball | Fled at`;\n- Captured mostra o breakdown de IVs em `HP · Atk · sAtk · Def · sDef · SpD`;\n- detalhes de Captured incluem Capsule, timestamp e Chance quando disponível.",
    "README Current",
)
protocol_section = '''\n### Compatibilidade de protocolo\n\nA v1.9 mantém uma fronteira explícita entre o protocolo observado do jogo e o domínio de analytics:\n\n```text\nPokePixel WebSocket\n        ↓\nwebsocket-observer.js\n        ↓\nprotocol-adapter.js\n        ↓ eventos canônicos\neventPipeline.js\n        ↓\ndomain + IndexedDB\n```\n\nO adapter aceita tanto o fluxo legado baseado em `combat.started`/`loot.received` quanto o novo HuntSim baseado em `hunt.frame`, `hunt.capture_queue`, `hunt.events` e rewards agregados. Projeções duplicadas do HuntSim são reconciliadas/ignoradas para evitar dupla contagem.\n\nDetalhes: [`docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md`](docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md).\n\n'''
readme = replace_once(readme, "### History\n", protocol_section + "### History\n", "README protocol section")
readme = readme.replace("A v1.8.0 usa permissões Tampermonkey", "A v1.9.0 usa permissões Tampermonkey")
readme = replace_once(
    readme,
    "├── websocket-observer.js\n├── tab-leadership.js",
    "├── websocket-observer.js\n├── protocol-adapter.js\n├── tab-leadership.js",
    "README source tree",
)
readme = replace_once(
    readme,
    "websocket-observer.js\n        ↓\nmain.js",
    "websocket-observer.js\n        ↓\nprotocol-adapter.js\n        ↓\nmain.js",
    "README flow",
)
readme = replace_once(
    readme,
    "- [`docs/PROTOCOL_AND_ANALYTICS.md`](docs/PROTOCOL_AND_ANALYTICS.md)\n- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)",
    "- [`docs/PROTOCOL_AND_ANALYTICS.md`](docs/PROTOCOL_AND_ANALYTICS.md)\n- [`docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md`](docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md)\n- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)",
    "README docs links",
)
readme = replace_once(
    readme,
    "`npm run validate` executa os testes e gera:\n\n```text\ndist/pokepixel-hunt-analyzer.user.js\n```",
    "`npm run validate` executa os testes e gera o build **PROD**:\n\n```text\ndist/pokepixel-hunt-analyzer.user.js\n```\n\nPara smoke do servidor DEV sem alterar a identidade de release:\n\n```bash\nnpm run build:userscript:dev\n```",
    "README development build",
)
write("README.md", readme)

# Architecture: protocol adapter is now a first-class runtime boundary.
arch = read("docs/ARCHITECTURE.md")
arch = replace_once(
    arch,
    "userscript/websocket-observer.js\n        ↓ parsed inbound payload\nuserscript/main.js\n        ↓ allowlist + serialized queue",
    "userscript/websocket-observer.js\n        ↓ parsed inbound payload\nuserscript/protocol-adapter.js\n        ↓ canonical legacy-shaped event(s)\nuserscript/main.js\n        ↓ allowlist + serialized queue",
    "Architecture runtime flow",
)
arch = replace_once(
    arch,
    "- `websocket-observer.js` — passive WebSocket constructor interception and frame decoding.\n- `tab-leadership.js`",
    "- `websocket-observer.js` — passive WebSocket constructor interception and frame decoding.\n- `protocol-adapter.js` — generation-specific protocol reconciliation; maps HuntSim frames/queues/rewards into canonical events while passing legacy events through unchanged.\n- `tab-leadership.js`",
    "Architecture modules",
)
arch = arch.replace("- protocol normalization;\n- encounter correlation/state transitions;", "- canonical event normalization (`domain/events.js`);\n- encounter correlation/state transitions;")
arch = replace_once(
    arch,
    "Observed event types are defined by `domain/events.js` and allowlisted before entering the pipeline.\n\nImportant rules:\n\n- protocol normalization belongs in `domain/events.js`;\n- frames outside the allowlist are ignored early;",
    "Observed raw payloads first pass through `userscript/protocol-adapter.js`. Legacy events pass through unchanged; HuntSim traffic may emit zero, one or multiple canonical events. Canonical event types are then defined/normalized by `domain/events.js` and allowlisted before entering the pipeline.\n\nImportant rules:\n\n- generation-specific reconciliation/decoding belongs in `userscript/protocol-adapter.js`;\n- canonical field normalization belongs in `domain/events.js`;\n- raw frames that are neither canonical nor adapter inputs are ignored early;",
    "Architecture event rules",
)
arch = arch.replace(
    "- `wildMonsterId` correlates a temporary encounter but is never the DB primary key;",
    "- `wildMonsterId` correlates a temporary encounter but is never the DB primary key; HuntSim uses a synthetic `huntsim:<server-session-or-zone>:<kill-seq>` value;",
)
arch = arch.replace(
    "- `capture.success` never overwrites the combat-started individual snapshot with captured-creature fields.",
    "- legacy `capture.success` never overwrites a complete combat-started individual snapshot; HuntSim successful captures may enrich fields missing from the synthetic/unmatched target because terminal `creature` data is authoritative for those fields, but `creature.level` is never used as target level.\n- duplicate HuntSim projections (`hunt.kill_reward`, `hunt.rewards`, capture projections in `hunt.events`) must not enter analytics twice.",
)
arch = replace_once(
    arch,
    "`scripts/build-userscript.mjs` injects the version from `package.json` and generates the Tampermonkey metadata block.\n\nCI performs",
    "`scripts/build-userscript.mjs` injects the version from `package.json` and generates the Tampermonkey metadata block. The default build targets PROD and preserves the historical production namespace. `npm run build:userscript:dev` uses a separate DEV identity/domain for live protocol smoke testing.\n\nCI performs",
    "Architecture build",
)
write("docs/ARCHITECTURE.md", arch)

# Protocol document: remove legacy-only assumptions and document HuntSim field ownership.
protocol = read("docs/PROTOCOL_AND_ANALYTICS.md")
protocol = replace_once(
    protocol,
    "## 1. Minimum inbound events\n\n```text\ncombat.started\nloot.received\ncapture.success\ncapture.failed\nhunt.stopped\nhunt.analyzer_reset\n```\n\nIgnore unrelated frames early and do not persist full WebSocket frames.",
    "## 1. Protocol generations and canonical inbound events\n\nThe domain pipeline remains canonical and consumes:\n\n```text\ncombat.started\nloot.received\ncapture.success\ncapture.failed\nhunt.stopped\nhunt.analyzer_reset\n```\n\nLegacy traffic already arrives in this shape. HuntSim additionally emits `hunt.frame`, `hunt.events`, `hunt.capture_queue`, `hunt.kill_reward` and `hunt.rewards`; `userscript/protocol-adapter.js` reconciles those raw payloads into the canonical events above. Duplicate projections are intentionally ignored. Raw WebSocket frames are never persisted.\n\nSee `docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md` for the observed frame/correlation contract.",
    "Protocol generations",
)
legacy_fields = "Both\nare combat.started-only — `capture.failed` doesn't carry either at all,\nsame non-overwrite policy as `level`/`quality`/`elements`/`gender`/\n`nature`."
if legacy_fields in protocol:
    protocol = protocol.replace(
        legacy_fields,
        "Under the legacy protocol these fields come from `combat.started`. Under HuntSim, successful terminal `capture.success.creature` may authoritatively fill fields absent from the synthetic target snapshot; failed HuntSim attempts expose only the subset documented in §4.",
        1,
    )
protocol = replace_once(
    protocol,
    "## 3. `loot.received`\n\nExtract:\n\n```text\nts\nwild_monster_id\nspecies_id\nexp\ntrainer_exp\npokemon_exp\ngold\nloot_sell_value\nauto_potion_used\nsupply_cost\n```",
    "## 3. `loot.received`\n\nLegacy individual reward extracts:\n\n```text\nts\nwild_monster_id\nspecies_id\nexp\ntrainer_exp\npokemon_exp\ngold\nloot_sell_value\nauto_potion_used\nsupply_cost\n```\n\nHuntSim may aggregate rewards in one envelope containing `kills`, `session_id` and `per_kill[]`. Each `per_kill` entry is converted by the adapter into one canonical individual reward correlated by kill sequence. Envelope totals must not be counted again after splitting.",
    "Protocol loot",
)
success_old = "The captured creature also carries `elements`, `gender`, `nature` and\n`quality_multiplier` (confirmed in a real capture) — none of these are\nextracted. Same reasoning as `creature.level`: the captured individual\nis not necessarily the same as the target snapshotted at\n`combat.started` (its own `level` already proves that), so nothing\nabout it overwrites that snapshot. `creature.quality`/`creature.ivs` ARE\nextracted above but, for the same reason, never used to patch an\nencounter row (`domain/encounterTracker.js`'s `applyCaptureResult`).\n`combat.started.data.enemy.elements/gender/nature/quality_multiplier/ivs`\n(§2) is the only source for those fields."
success_new = "The captured creature also carries `elements`, `gender`, `nature`, `quality_multiplier` and `captured_by_name`. A complete legacy `combat.started` snapshot remains preferred for individual target fields. HuntSim, however, may have no equivalent complete target snapshot; in that case successful terminal `creature` fields are preserved/enriched because they are the only authoritative source available. `creature.level` is the exception and is never used as hunted target level. Unmatched HuntSim successes retain these terminal fields instead of degrading to an empty orphan."
protocol = replace_once(protocol, success_old, success_new, "Protocol capture success")
protocol = replace_once(
    protocol,
    "Temporary lookup:\n\n```javascript\nactiveByWildMonsterId.set(wildMonsterId, encounterId)\n```\n\nExpected flow:\n\n```text\ncombat.started\n      ↓\n   STARTED\n      ↓\nloot.received\n      ↓\n    LOOTED\n   ↙      ↘\nsuccess  failed\n```",
    "Temporary lookup:\n\n```javascript\nactiveByWildMonsterId.set(wildMonsterId, encounterId)\n```\n\nLegacy expected flow:\n\n```text\ncombat.started → loot.received → capture.success / capture.failed\n```\n\nHuntSim commonly uses:\n\n```text\nhunt.frame / hunt.capture_queue / hunt.events\n                  ↓ kill sequence\ncapture.success / capture.failed\n                  ↓\nloot.received.per_kill[]   (may arrive after terminal capture)\n```\n\nThe adapter synthesizes `wildMonsterId = huntsim:<server-session-or-zone>:<kill-seq>` so the existing tracker/persistence model can remain stable.",
    "Protocol correlation",
)
protocol = protocol.replace(
    "Finalize/remove on capture result, wild-id reuse by a new `combat.started`, or conservative stale timeout.",
    "Legacy correlation finalizes/removes on capture result, wild-id reuse by a new `combat.started`, or conservative stale timeout. HuntSim keeps finalized correlation long enough for late loot to patch the same encounter, then releases it after reward reconciliation/closure.",
)
baseline = "The fixture also contains wild-id reuse and orphan events. Do not hard-code a final normalized encounter count until correlation rules are covered by tests."
protocol = replace_once(
    protocol,
    baseline,
    baseline + "\n\nObserved HuntSim DEV capture used for v1.9 compatibility validation included approximately 7,209 `hunt.frame`, 681 `hunt.capture_queue`, 628 `hunt.events`, 312 `hunt.kill_reward`, 309 `hunt.rewards`, 309 `loot.received`, 249 `capture.failed` and 46 `capture.success` messages. These counts are evidence for adapter behavior, not constants to hard-code. The legacy 4000+ fixture remains the regression baseline and currently persists 4,128 encounter rows.",
    "Protocol HuntSim baseline",
)
write("docs/PROTOCOL_AND_ANALYTICS.md", protocol)

# HuntSim compatibility document: release-ready contract + two build targets.
huntsim = read("docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md")
huntsim = huntsim.replace(
    "Status: DEV-only implementation on `dev/huntsim-protocol-compat`.",
    "Status: v1.9.0 release-ready compatibility layer. Validated against the HuntSim DEV protocol; merge/release is intentionally gated on the game update reaching production.",
)
huntsim = huntsim.replace("Production v1.8 analytics", "The legacy analytics path")
huntsim = huntsim.replace("the v1.8 pipeline", "the canonical pipeline")
old_build = '''## Build isolation

The branch builds a DEV-only Tampermonkey identity:

```text
@name      PokePixel Hunt Analyzer DEV
@namespace https://github.com/leojlsv/pokepixel-hunt-analyzer/dev
@match     https://dev.pokepixel.nietore.com/*
```

This prevents the DEV test userscript from replacing or executing on the released PROD userscript.
'''
new_build = '''## Build targets

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
'''
huntsim = replace_once(huntsim, old_build, new_build, "HuntSim build section")
write("docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md", huntsim)

# Capture Ticket spec: final data fallback and raster contract.
tickets = read("docs/CAPTURE_TICKETS.md")
tickets = tickets.replace(
    "- player: `capturedByName`, normalized from `capture.success.captured_by_name`",
    "- player: `capturedByName`, normalized from `capture.success.captured_by_name` with `capture.success.creature.captured_by_name` fallback",
)
tickets = tickets.replace(
    "The 96×96 source is drawn at 192×192 with image smoothing disabled.",
    "The sprite has a fixed 192×192 useful area in the ticket. At `1x`, the complete source PNG canvas (including transparent padding) is fitted proportionally inside that area, centered and clipped to it. Canvas smoothing remains disabled for the raster pass and the preview uses pixelated rendering; no bilinear/high-quality smoothing is applied to the Pokémon sprite.",
)
tickets = tickets.replace(
    "- Generate preview/download\n- Copy image and paste into Discord",
    "- Generate preview/download, including top-level modal mounting and Escape/close behavior\n- Pokémon sprite 192×192 useful-area fit with 1x baseline and nearest-neighbor/pixelated rendering\n- Copy image and paste into Discord",
)
write("docs/CAPTURE_TICKETS.md", tickets)

# Development: adapter boundary, DEV branch/build and release gate.
dev = read("docs/DEVELOPMENT.md")
dev = dev.replace("feat/\nfix/\nrefactor/\ndocs/\nrelease/", "feat/\nfix/\nrefactor/\ndocs/\ndev/\nrelease/")
dev = dev.replace(
    "- Protocol normalization belongs in `domain/events.js`.",
    "- Generation-specific protocol reconciliation belongs in `userscript/protocol-adapter.js`; canonical event normalization belongs in `domain/events.js`.",
)
dev = replace_once(
    dev,
    "Before consuming a new field/event:\n\n1. confirm it from real protocol evidence;\n2. document semantics in `docs/PROTOCOL_AND_ANALYTICS.md`;\n3. normalize it in `domain/events.js`;\n4. update tracker/persistence only if the product needs it;\n5. add regression coverage;\n6. verify that sensitive/raw data is not persisted.",
    "Before consuming a new field/event:\n\n1. confirm it from real protocol evidence;\n2. document semantics in `docs/PROTOCOL_AND_ANALYTICS.md` (and `docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md` when generation-specific);\n3. reconcile generation-specific/raw shapes in `userscript/protocol-adapter.js`;\n4. normalize the resulting canonical event in `domain/events.js`;\n5. update tracker/persistence only if the product needs it;\n6. add regression coverage;\n7. verify that sensitive/raw data is not persisted or logged.",
    "Development protocol workflow",
)
dev = dev.replace(
    "- encounter correlation/dedupe;",
    "- encounter correlation/dedupe, including HuntSim kill-sequence correlation and terminal-before-loot ordering;",
)
dev = dev.replace(
    "8. Captured / Failed lists, filters and detail expansion work.",
    "8. Captured filters/details work; Failed shows Pokémon / IV / Pokéball / Fled at directly with Rarity/Shiny/IV filters.",
)
dev = replace_once(
    dev,
    "Build only:\n\n```bash\nnpm run build:userscript\n```",
    "Production build:\n\n```bash\nnpm run build:userscript\n```\n\nIsolated DEV protocol build:\n\n```bash\nnpm run build:userscript:dev\n```",
    "Development build commands",
)
dev = dev.replace(
    "8. build/install the userscript from that exact release branch and complete section 8;",
    "8. build/install the **production** userscript from that exact release branch and complete section 8; for a protocol transition, also validate the isolated DEV build before the game update reaches production;",
)
write("docs/DEVELOPMENT.md", dev)
