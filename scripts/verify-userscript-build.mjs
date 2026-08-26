import { readFile } from "node:fs/promises";

const packageUrl = new URL("../package.json", import.meta.url);
const packageLockUrl = new URL("../package-lock.json", import.meta.url);
const userscriptUrl = new URL("../dist/pokepixel-hunt-analyzer.user.js", import.meta.url);
const metadataUrl = new URL("../dist/pokepixel-hunt-analyzer.meta.js", import.meta.url);

const [pkg, lock, userscript, metadata] = await Promise.all([
  readFile(packageUrl, "utf8").then(JSON.parse),
  readFile(packageLockUrl, "utf8").then(JSON.parse),
  readFile(userscriptUrl, "utf8"),
  readFile(metadataUrl, "utf8")
]);

const expectedVersion = pkg.version;
const expectedUpdateUrl =
  "https://github.com/leojlsv/pokepixel-hunt-analyzer/releases/latest/download/pokepixel-hunt-analyzer.meta.js";
const expectedDownloadUrl =
  "https://github.com/leojlsv/pokepixel-hunt-analyzer/releases/latest/download/pokepixel-hunt-analyzer.user.js";

function metadataBlock(source) {
  const end = source.indexOf("// ==/UserScript==");
  if (end < 0) throw new Error("Missing userscript metadata terminator");
  return source.slice(0, end + "// ==/UserScript==".length).trim();
}

function assertIncludes(source, value, label) {
  if (!source.includes(value)) {
    throw new Error(`${label} is missing: ${value}`);
  }
}

if (lock.version !== expectedVersion || lock.packages?.[""]?.version !== expectedVersion) {
  throw new Error(
    `package-lock version mismatch: package=${expectedVersion}, lock=${lock.version}, root=${lock.packages?.[""]?.version}`
  );
}

assertIncludes(metadata, `// @version      ${expectedVersion}`, "metadata");
assertIncludes(userscript, `// @version      ${expectedVersion}`, "userscript");
assertIncludes(metadata, `// @updateURL    ${expectedUpdateUrl}`, "metadata");
assertIncludes(userscript, `// @updateURL    ${expectedUpdateUrl}`, "userscript");
assertIncludes(metadata, `// @downloadURL  ${expectedDownloadUrl}`, "metadata");
assertIncludes(userscript, `// @downloadURL  ${expectedDownloadUrl}`, "userscript");

if (metadataBlock(metadata) !== metadataBlock(userscript)) {
  throw new Error("Production .meta.js and .user.js metadata blocks differ");
}

console.log(`Verified release/update invariants v${expectedVersion}`);
