import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(directory, "entry.js")],
  outfile: path.join(directory, "reference.bundle.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  loader: { ".png": "dataurl" },
  logLevel: "warning"
});
console.log("Generated docs/visual-redesign/reference/reference.bundle.js");
