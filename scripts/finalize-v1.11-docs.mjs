import { readFile, writeFile } from "node:fs/promises";

function replaceSection(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`${label}: section markers not found`);
  }
  return `${text.slice(0, start)}${replacement.trimEnd()}\n\n${text.slice(end)}`;
}

const readmePath = new URL("../README.md", import.meta.url);
let readme = await readFile(readmePath, "utf8");
readme = readme.replace("**Versão:** `v1.10.0`", "**Versão:** `v1.11.0`");

const installSection = `## 2. Instale o userscript

Na release mais recente, use o asset:

\`\`\`text
pokepixel-hunt-analyzer.user.js
\`\`\`

### [⬇️ Releases](https://github.com/leojlsv/pokepixel-hunt-analyzer/releases/latest)

Ao abrir o \`.user.js\`, o Tampermonkey deve oferecer a instalação. Como fallback, ainda é possível criar um userscript manualmente, colar o conteúdo completo do arquivo e salvar.

## 3. Atualizações pelo Tampermonkey

A partir da **v1.11.0**, o userscript PROD inclui o canal nativo de atualização do Tampermonkey.

- o Tampermonkey consulta \`pokepixel-hunt-analyzer.meta.js\`, um manifest leve usado para comparar versões;
- quando uma atualização é aceita, o Tampermonkey obtém \`pokepixel-hunt-analyzer.user.js\`;
- aviso, frequência de verificação e instalação automática continuam sob controle das configurações do próprio Tampermonkey;
- o Analyzer não consulta GitHub em runtime e não possui popup/banner próprio de atualização.

Quem estiver em **v1.10.0 ou anterior precisa instalar a v1.11.0 manualmente uma última vez**. Depois disso, o canal nativo fica registrado no Tampermonkey para releases futuras.

Recarregue \`https://pokepixel.nietore.com/\` após instalar/atualizar. O HUD \`PX\` deve aparecer normalmente.

Contrato completo: [\`docs/TAMPERMONKEY_UPDATES.md\`](docs/TAMPERMONKEY_UPDATES.md).`;

readme = replaceSection(
  readme,
  "## 2. Baixe o userscript",
  "---\n\n# Uso básico",
  installSection,
  "README install/update"
);

const updatingSection = `# Atualizando

**v1.10.0 ou anterior:** faça a atualização para v1.11.0 manualmente pelo asset \`.user.js\` da release. Essa é a última atualização obrigatoriamente manual para habilitar o canal nativo.

**v1.11.0 em diante:** use o mecanismo de atualização do Tampermonkey. O script declara \`@updateURL\` para o metadata leve e \`@downloadURL\` para o userscript completo; o Tampermonkey decide quando avisar, verificar ou instalar conforme as preferências do usuário.

Migrations compatíveis preservam os dados existentes no IndexedDB. O mecanismo de update não adiciona backend, telemetry ou permissões de runtime ao Analyzer.`;

readme = replaceSection(
  readme,
  "# Atualizando",
  "---\n\n# Desenvolvimento",
  updatingSection,
  "README updating"
);

readme = readme.replace(
  "`npm run validate` executa os testes e gera o build **PROD**:\n\n```text\ndist/pokepixel-hunt-analyzer.user.js\n```",
  "`npm run validate` executa os testes, gera o build **PROD** e valida o contrato de metadata:\n\n```text\ndist/pokepixel-hunt-analyzer.meta.js\ndist/pokepixel-hunt-analyzer.user.js\n```"
);

const updateDocLink = "- [`docs/TAMPERMONKEY_UPDATES.md`](docs/TAMPERMONKEY_UPDATES.md)";
if (!readme.includes(updateDocLink)) {
  const anchor = "- [`docs/CAPTURE_TICKETS.md`](docs/CAPTURE_TICKETS.md)";
  if (!readme.includes(anchor)) throw new Error("README docs link anchor not found");
  readme = readme.replace(anchor, `${anchor}\n${updateDocLink}`);
}
await writeFile(readmePath, readme, "utf8");

const developmentPath = new URL("../docs/DEVELOPMENT.md", import.meta.url);
let development = await readFile(developmentPath, "utf8");
development = development.replace(
  "`validate` runs the complete Node test suite and builds the production userscript.",
  "`validate` runs the complete Node test suite, builds the production userscript + metadata manifest and verifies their update contract."
);
development = development.replace(
  "Output:\n\n```text\ndist/pokepixel-hunt-analyzer.user.js\n```",
  "Output:\n\n```text\ndist/pokepixel-hunt-analyzer.meta.js\ndist/pokepixel-hunt-analyzer.user.js\n```"
);

const releaseSection = `Release process:

1. prepare the release version on the validated feature/release branch;
2. update \`package.json\` and synchronize \`package-lock.json\`;
3. update README, CHANGELOG and affected technical docs;
4. run \`npm ci\`, \`npm run audit:deps\` and \`npm run validate\`;
5. install/smoke the **production** userscript from that exact branch when runtime behavior changed;
6. open/update the release PR against \`main\` and require green CI;
7. merge the validated release PR;
8. require green CI on the resulting \`main\` commit;
9. create \`publish/vX.Y.Z\` from that exact merged \`main\` commit and push it;
10. \`.github/workflows/publish.yml\` verifies version/main alignment, re-runs audit + validation, creates tag \`vX.Y.Z\`, publishes both update assets and removes the temporary publish branch;
11. verify the release, both assets and the stable \`releases/latest/download/...\` routes before announcing it.

The two mandatory production release assets are:

\`\`\`text
pokepixel-hunt-analyzer.meta.js
pokepixel-hunt-analyzer.user.js
\`\`\`

Their filenames are a compatibility contract with already-installed Tampermonkey scripts and must not be renamed.

The complete update/release contract, bootstrap behavior, invariants, smoke procedure, hotfix policy and post-release checklist live in [\`TAMPERMONKEY_UPDATES.md\`](TAMPERMONKEY_UPDATES.md). Treat that document as normative for every release from v1.11.0 onward.

Do not release from a temporary test/harness branch. The only publication branch pattern is \`publish/vX.Y.Z\`, created after merge from the current \`main\` commit.`;

development = replaceSection(
  development,
  "Release process:",
  "## 10. Security",
  releaseSection,
  "DEVELOPMENT release process"
);
await writeFile(developmentPath, development, "utf8");

const changelogPath = new URL("../CHANGELOG.md", import.meta.url);
let changelog = await readFile(changelogPath, "utf8");
if (!changelog.includes("## [1.11.0]")) {
  const marker = "The project follows Semantic Versioning.\n";
  if (!changelog.includes(marker)) throw new Error("CHANGELOG header marker not found");
  const entry = `
## [1.11.0] - 2026-08-26

### Native Tampermonkey updates
- Production builds now declare stable \`@updateURL\` and \`@downloadURL\` metadata so update discovery and installation are controlled by Tampermonkey rather than by Analyzer runtime code.
- Production builds now generate a lightweight \`pokepixel-hunt-analyzer.meta.js\` alongside the full \`.user.js\`; DEV builds remain isolated and publish no update metadata.
- Added automated checks that the package version, production metadata, userscript header and canonical update URLs remain consistent.
- Added a guarded \`publish/vX.Y.Z\` release workflow that only publishes from the current merged \`main\` commit and uploads both stable update assets.
- Added \`docs/TAMPERMONKEY_UPDATES.md\` as the normative release/update contract, including bootstrap, invariants, smoke testing, hotfixes and post-release verification.

### Bootstrap note
- v1.11.0 is the first release carrying the native update channel. Users on v1.10.0 or older must install v1.11.0 manually once; subsequent releases can be detected by Tampermonkey.
- No Analyzer UI update notification, GitHub runtime polling, IndexedDB migration, new dependency, grant or \`@connect\` permission was added.
`;
  changelog = changelog.replace(marker, `${marker}\n${entry}`);
}
await writeFile(changelogPath, changelog, "utf8");

console.log("Finalized v1.11.0 documentation");
