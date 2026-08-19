import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const metadata = `// ==UserScript==
// @name         PokePixel Hunt Analyzer
// @namespace    https://github.com/leojlsv/pokepixel-analyzer-sidepanel
// @version      ${pkg.version}
// @description  Passive local Hunt analytics for PokePixel. Current + Compare + JSON export.
// @author       Rhyxus
// @match        https://pokepixel.nietore.com/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// ==/UserScript==`;

await mkdir(new URL("../dist/", import.meta.url), { recursive: true });

await build({
  entryPoints: [new URL("../userscript/main.js", import.meta.url).pathname],
  outfile: new URL("../dist/pokepixel-hunt-analyzer.user.js", import.meta.url).pathname,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome114", "firefox128"],
  legalComments: "none",
  minify: false,
  sourcemap: false,
  banner: { js: metadata },
  define: {
    "process.env.NODE_ENV": '"production"'
  }
});

console.log("Built dist/pokepixel-hunt-analyzer.user.js");
