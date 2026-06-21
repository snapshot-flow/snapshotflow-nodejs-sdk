/**
 * SnapshotFlow SDK — public entry point.
 *
 * Quick start:
 *   import { SnapshotFlow, TakeOptions } from "snapshotflow";
 *   const client = new SnapshotFlow({ apiKey: process.env.SNAPSHOTFLOW_API_KEY! });
 *   const shot = await client.take({ url: "https://example.com" });
 *   await shot.save("example.png");
 */

export { SnapshotFlow, ScreenshotResult } from "./client.js";
export { TakeOptions, resolveOptions } from "./options.js";
export type { OptionsInput } from "./options.js";
export { verifyWebhook } from "./url.js";
export type { VerifyWebhookArgs } from "./url.js";

export {
  SnapshotFlowError,
  ConfigError,
  NetworkError,
  ValidationError,
  InvalidUrlError,
  AuthError,
  QuotaExceededError,
  BlockedUrlError,
  TimeoutError,
  NavigationError,
  SelectorNotFoundError,
  RateLimitError,
  PoolExhaustedError,
} from "./errors.js";
export type { ErrorCode } from "./errors.js";

export type * from "./types.js";
