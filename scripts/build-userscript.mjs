import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageUrl = new URL("../package.json", import.meta.url);
const entryUrl = new URL("../userscript/main.js", import.meta.url);
const distDirUrl = new URL("../dist/", import.meta.url);
const outputUrl = new URL("../dist/pokepixel-hunt-analyzer.user.js", import.meta.url);

const pkg = JSON.parse(await readFile(packageUrl, "utf8"));

const metadata = `// ==UserScript==
// @name         PokePixel Hunt Analyzer
// @namespace    https://github.com/leojlsv/pokepixel-analyzer-sidepanel
// @version      ${pkg.version}
// @description  Passive local Hunt analytics for PokePixel. Current + Compare.
// @author       Rhyxus
// @license      MIT
// @match        https://pokepixel.nietore.com/*
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
    __APP_VERSION__: JSON.stringify(pkg.version),
    "process.env.NODE_ENV": '"production"'
  }
});

console.log(`Built dist/pokepixel-hunt-analyzer.user.js v${pkg.version}`);
