import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createUserscriptMetadata } from "./userscript-metadata.mjs";

const packageUrl = new URL("../package.json", import.meta.url);
const entryUrl = new URL("../userscript/main.js", import.meta.url);
const distDirUrl = new URL("../dist/", import.meta.url);
const outputUrl = new URL("../dist/pokepixel-hunt-analyzer.user.js", import.meta.url);
const metadataOutputUrl = new URL("../dist/pokepixel-hunt-analyzer.meta.js", import.meta.url);

const pkg = JSON.parse(await readFile(packageUrl, "utf8"));
const isDevBuild = process.argv.includes("--dev");
const appVersion = isDevBuild ? `${pkg.version}-dev` : pkg.version;
const metadata = createUserscriptMetadata({ appVersion, isDevBuild });

await mkdir(fileURLToPath(distDirUrl), { recursive: true });

if (isDevBuild) {
  // DEV builds must never leave behind a publishable PROD update manifest.
  await rm(fileURLToPath(metadataOutputUrl), { force: true });
} else {
  await writeFile(fileURLToPath(metadataOutputUrl), metadata, "utf8");
}

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

if (isDevBuild) {
  console.log(`Built dist/pokepixel-hunt-analyzer.user.js v${appVersion} (DEV)`);
} else {
  console.log(
    `Built dist/pokepixel-hunt-analyzer.user.js and dist/pokepixel-hunt-analyzer.meta.js v${appVersion} (PROD)`
  );
}
