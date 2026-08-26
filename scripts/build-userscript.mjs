import { build } from "esbuild";
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
