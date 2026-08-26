import test from "node:test";
import assert from "node:assert/strict";
import {
  PROD_DOWNLOAD_URL,
  PROD_UPDATE_URL,
  createUserscriptMetadata
} from "../../scripts/userscript-metadata.mjs";

test("production metadata enables native Tampermonkey update checks", () => {
  const metadata = createUserscriptMetadata({
    appVersion: "1.11.0",
    isDevBuild: false
  });

  assert.match(metadata, /^\/\/ ==UserScript==/);
  assert.match(metadata, /\/\/ @version\s+1\.11\.0/);
  assert.ok(metadata.includes(`// @updateURL    ${PROD_UPDATE_URL}`));
  assert.ok(metadata.includes(`// @downloadURL  ${PROD_DOWNLOAD_URL}`));
  assert.match(metadata, /\/\/ @match\s+https:\/\/pokepixel\.nietore\.com\/\*/);
  assert.match(metadata, /\/\/ ==\/UserScript==\n$/);
});

test("DEV metadata remains isolated from production updates", () => {
  const metadata = createUserscriptMetadata({
    appVersion: "1.11.0-dev",
    isDevBuild: true
  });

  assert.match(metadata, /\/\/ @name\s+PokePixel Hunt Analyzer DEV/);
  assert.match(metadata, /\/\/ @version\s+1\.11\.0-dev/);
  assert.match(metadata, /\/\/ @match\s+https:\/\/dev\.pokepixel\.nietore\.com\/\*/);
  assert.equal(metadata.includes("@updateURL"), false);
  assert.equal(metadata.includes("@downloadURL"), false);
});
