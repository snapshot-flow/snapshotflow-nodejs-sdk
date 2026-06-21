/**
 * URL building, option serialization, and webhook verification.
 *
 * These functions are pure (no network) so they can be unit-tested in isolation
 * and used to build `<img src>` links without making a request.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ScreenshotOptions } from "./types.js";

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

function base64(input: string): string {
  return Buffer.from(input, "utf8").toString("base64");
}

/**
 * Convert camelCase screenshot options into the API's snake_case string params.
 * Undefined values are skipped. Complex values are serialized:
 *  - `html` -> base64
 *  - `headers` / `cookies` -> JSON string
 *  - `hideSelectors` / `blockRequests` -> comma-joined string
 */
export function serializeOptions(options: ScreenshotOptions): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue;

    switch (key) {
      case "html":
        out.html = base64(value as string);
        break;
      case "headers":
      case "cookies":
        out[toSnakeCase(key)] = JSON.stringify(value);
        break;
      case "hideSelectors":
      case "blockRequests":
        out[toSnakeCase(key)] = (value as string[]).join(",");
        break;
      default:
        out[toSnakeCase(key)] = String(value);
    }
  }

  return out;
}

/** Build a query string from a flat record (stable, sorted key order). */
export function toQueryString(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    search.append(key, params[key] as string);
  }
  return search.toString();
}

export interface BuildUrlInput {
  baseUrl: string;
  path: string;
  params: Record<string, string>;
  apiKey?: string;
}

/**
 * Build a full request URL (e.g. for an `<img src>`).
 *
 * NOTE: the backend does not currently verify signed screenshot URLs, so the
 * SDK does not produce signed links. The `api_key` is passed as a query param;
 * be mindful that this exposes the key in the URL. For server-side use prefer
 * `client.take()`, which sends the key in the `X-Api-Key` header instead.
 */
export function buildUrl(input: BuildUrlInput): string {
  const params = { ...input.params };
  if (input.apiKey) params.api_key = input.apiKey;
  const query = toQueryString(params);
  return `${input.baseUrl.replace(/\/$/, "")}${input.path}?${query}`;
}

export interface VerifyWebhookArgs {
  /** Raw request body bytes/string — do NOT parse then re-serialize first. */
  rawBody: string;
  /** Full `X-SnapshotFlow-Signature` header value, e.g. `t=1700000000,sha256=abc...`. */
  signatureHeader: string;
  /** Shared webhook secret. */
  secret: string;
  /** Max age in seconds before a signature is considered stale. Default 300. Set 0 to skip. */
  toleranceSec?: number;
}

/**
 * Verify an incoming SnapshotFlow webhook.
 *
 * The backend signs `${t}.${rawBody}` with HMAC-SHA256 and sends the header
 * `X-SnapshotFlow-Signature: t=<unix-seconds>,sha256=<hex>`. This parses the
 * header, enforces a freshness window, and compares in constant time.
 */
export function verifyWebhook(args: VerifyWebhookArgs): boolean {
  const tolerance = args.toleranceSec ?? 300;

  const parts: Record<string, string> = {};
  for (const segment of args.signatureHeader.split(",")) {
    const idx = segment.indexOf("=");
    if (idx === -1) continue;
    parts[segment.slice(0, idx).trim()] = segment.slice(idx + 1).trim();
  }

  const timestamp = parts.t;
  const received = parts.sha256;
  if (!timestamp || !received) return false;

  if (tolerance > 0) {
    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (Number.isNaN(age) || age > tolerance) return false;
  }

  const expected = createHmac("sha256", args.secret)
    .update(`${timestamp}.${args.rawBody}`)
    .digest();

  // Decode the received hex to bytes; reject if it isn't valid, full-length hex.
  // (Buffer.from silently truncates on bad input, so compare byte lengths.)
  const receivedBytes = Buffer.from(received, "hex");
  if (receivedBytes.length !== expected.length) return false;
  return timingSafeEqual(receivedBytes, expected);
}
