export const PROD_UPDATE_URL =
  "https://github.com/leojlsv/pokepixel-hunt-analyzer/releases/latest/download/pokepixel-hunt-analyzer.meta.js";
export const PROD_DOWNLOAD_URL =
  "https://github.com/leojlsv/pokepixel-hunt-analyzer/releases/latest/download/pokepixel-hunt-analyzer.user.js";

export function createUserscriptMetadata({ appVersion, isDevBuild = false }) {
  const lines = [
    "// ==UserScript==",
    `// @name         ${isDevBuild ? "PokePixel Hunt Analyzer DEV" : "PokePixel Hunt Analyzer"}`,
    `// @namespace    ${isDevBuild ? "https://github.com/leojlsv/pokepixel-hunt-analyzer/dev" : "https://github.com/leojlsv/pokepixel-analyzer-sidepanel"}`,
    `// @version      ${appVersion}`,
    `// @description  ${isDevBuild ? "DEV-only HuntSim compatibility build for PokePixel Hunt Analyzer." : "Passive Hunt analytics for PokePixel. Current, History and local tools."}`,
    "// @author       Rhyxus",
    "// @license      MIT"
  ];

  if (!isDevBuild) {
    lines.push(
      `// @updateURL    ${PROD_UPDATE_URL}`,
      `// @downloadURL  ${PROD_DOWNLOAD_URL}`
    );
  }

  lines.push(
    `// @match        ${isDevBuild ? "https://dev.pokepixel.nietore.com/*" : "https://pokepixel.nietore.com/*"}`,
    "// @run-at       document-start",
    "// @sandbox      raw",
    "// @grant        GM_xmlhttpRequest",
    "// @grant        unsafeWindow",
    "// @connect      img.pokemondb.net",
    "// ==/UserScript=="
  );

  return `${lines.join("\n")}\n`;
}
