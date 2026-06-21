import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Contract test: every screenshot parameter the backend supports must be
 * representable by the SDK. Guards against drift when the backend adds params.
 *
 * Skips automatically when the backend repo isn't checked out next to the SDK
 * (e.g. in a published standalone package).
 */

const here = dirname(fileURLToPath(import.meta.url));
const backendTypes = resolve(here, "../../screenshot-backend/src/types.ts");
const sdkTypes = resolve(here, "../src/types.ts");

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

/** Extract `field` names from a named interface body. */
function interfaceKeys(source: string, name: string): string[] {
  const start = source.indexOf(`interface ${name} {`);
  if (start === -1) return [];
  const body = source.slice(start, source.indexOf("\n}", start));
  const keys: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*([a-zA-Z_][\w]*)\??:/);
    if (m && m[1]) keys.push(m[1]);
  }
  return keys;
}

describe.skipIf(!existsSync(backendTypes))("backend parameter coverage", () => {
  it("SDK ScreenshotOptions covers every backend ScreenshotOptions param", () => {
    const backendKeys = interfaceKeys(readFileSync(backendTypes, "utf8"), "ScreenshotOptions");
    const sdkKeys = new Set(
      interfaceKeys(readFileSync(sdkTypes, "utf8"), "ScreenshotOptions").map(toSnakeCase),
    );

    expect(backendKeys.length).toBeGreaterThan(0);
    const missing = backendKeys.filter((k) => !sdkKeys.has(k));
    expect(missing, `SDK is missing params: ${missing.join(", ")}`).toEqual([]);
  });
});
