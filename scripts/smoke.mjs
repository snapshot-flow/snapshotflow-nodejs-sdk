/**
 * Smoke test for the published artifact.
 * Run after `npm run build`:
 *   - verifies `npm pack` includes the `dist` output
 *   - verifies the built ESM and CJS entry points import and expose the API
 *
 * Usage: node scripts/smoke.mjs  (or `npm run smoke`)
 */

import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const EXPECTED = ["SnapshotFlow", "TakeOptions", "SnapshotFlowError", "verifyWebhook"];

function fail(msg) {
  console.error(`smoke: FAIL — ${msg}`);
  process.exit(1);
}

// 1. npm pack must include dist/index.js, dist/index.cjs, dist/index.d.ts
const packed = execSync("npm pack --dry-run --json", { encoding: "utf8" });
const files = JSON.parse(packed)[0].files.map((f) => f.path);
for (const required of ["dist/index.js", "dist/index.cjs", "dist/index.d.ts"]) {
  if (!files.includes(required)) fail(`npm pack is missing ${required}`);
}

// 2. ESM import
const esm = await import("../dist/index.js");
for (const name of EXPECTED) {
  if (!(name in esm)) fail(`ESM build is missing export "${name}"`);
}

// 3. CJS require
const require = createRequire(import.meta.url);
const cjs = require("../dist/index.cjs");
for (const name of EXPECTED) {
  if (!(name in cjs)) fail(`CJS build is missing export "${name}"`);
}

console.log("smoke: OK — npm pack contents and ESM/CJS imports verified");
