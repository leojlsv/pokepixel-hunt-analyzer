# Bootstrap sequence

This package is an overlay for the existing v0.3.0 repository.
It intentionally does **not** contain or replace `manifest.json`, `hook.js`, `content.js`, `background.js`, `sidepanel/`, `start-preview.ps1` or the current `README.md`.

## 1. Preserve the current baseline

```powershell
git status
git add .
git commit -m "chore: preserve v0.3.0 baseline"
git tag v0.3.0
```

If the repo is not initialized yet, run `git init` first. Do not recreate the tag if it already exists.

## 2. Copy this overlay into the repository root

Expected additions:

```text
CLAUDE.md
CHANGELOG.md
.gitignore
.claude/skills/
docs/
prompts/
scripts/
background/
domain/
data/
services/
tests/
```

Future-code directories contain `.gitkeep` because Git does not version truly empty directories.

## 3. Install Claude Code skills

Optional but recommended:

```powershell
.\scripts\install-claude-skills.ps1
```

This installs `javascript-pro` and `test-master` from the third-party Jeffallan/claude-skills repository. Review them before committing.

## 4. Review and commit the scaffold

```powershell
git status
git diff
git add CLAUDE.md CHANGELOG.md .gitignore .claude docs prompts scripts background domain data services tests
git commit -m "docs: add Claude Code v1 development scaffold"
```

## 5. Start Claude Code in Plan Mode

```powershell
claude --permission-mode plan
```

Inside Claude Code run `/context` and confirm `CLAUDE.md` appears under Memory files.

## 6. Run the initial analysis

Open `prompts/01_INITIAL_ANALYSIS.md` and paste the prompt section into Claude.
Do not implement on the first pass.

## 7. Approve only Phase 1

Verify that the plan preserves v0.3.0, does not change UI or WebSocket behavior, keeps the scope small, and identifies tests first.

Then approve implementation with:

```text
Implemente somente a Fase 1 aprovada.
Não avance para a Fase 2.
Ao final mostre arquivos alterados, testes executados, resultados, decisões tomadas e pendências.
```

## 8. Review before commit

Use `/diff` in Claude Code, then:

```powershell
git status
git diff
```

Run tests before committing Phase 1.
