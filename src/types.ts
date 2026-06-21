/**
 * Public types for the SnapshotFlow SDK.
 *
 * Option fields use camelCase. The SDK converts them to the API's snake_case
 * query parameters internally (see `src/url.ts`).
 */

export type Format = "png" | "jpeg" | "webp" | "pdf";
export type WaitUntil = "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
export type MediaType = "screen" | "print";
export type ContentFormat = "html" | "markdown" | "text";
export type ResponseType = "image" | "json" | "base64" | "url";
/** `/diff` does not support the `url` response type. */
export type DiffResponseType = "image" | "json" | "base64";
export type PdfPaperFormat = "a4" | "a3" | "a2" | "a1" | "letter" | "legal" | "tabloid";
export type JobStatus = "pending" | "processing" | "done" | "failed";

/** A cookie to set on the page before capture. */
export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
}

/**
 * All options accepted by the `/screenshot` endpoint.
 * Every field is optional except that one of `url` or `html` must be provided.
 */
export interface ScreenshotOptions {
  // Source
  url?: string;
  /** Raw HTML to render instead of navigating to a URL. SDK base64-encodes it. */
  html?: string;

  // Viewport
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
  viewportMobile?: boolean;

  // Capture
  format?: Format;
  quality?: number;
  fullPage?: boolean;
  omitBackground?: boolean;
  selector?: string;
  clipX?: number;
  clipY?: number;
  clipWidth?: number;
  clipHeight?: number;
  imageWidth?: number;
  imageHeight?: number;

  // Timing
  delay?: number;
  waitUntil?: WaitUntil;
  waitForSelector?: string;

  // Emulation
  darkMode?: boolean;
  reducedMotion?: boolean;
  mediaType?: MediaType;
  timezone?: string;
  geolocationLatitude?: number;
  geolocationLongitude?: number;
  geolocationAccuracy?: number;
  userAgent?: string;

  // Injection & interaction
  headers?: Record<string, string>;
  cookies?: Cookie[];
  styles?: string;
  scripts?: string;
  hideSelectors?: string[];
  click?: string;

  // Blocking
  blockAds?: boolean;
  blockTrackers?: boolean;
  blockCookieBanners?: boolean;
  blockRequests?: string[];

  // PDF
  pdfPrintBackground?: boolean;
  pdfLandscape?: boolean;
  pdfPaperFormat?: PdfPaperFormat;

  // Content & metadata extraction
  extractContent?: boolean;
  contentFormat?: ContentFormat;
  metadata?: boolean;

  // Async / webhook
  async?: boolean;
  webhookUrl?: string;
  /** Echoed back in webhook headers (X-SnapshotFlow-External-Id) for correlation. */
  externalIdentifier?: string;
  /** Include error details in the webhook payload for failed jobs. Default true. */
  webhookErrors?: boolean;

  // Cache & response
  cache?: boolean;
  responseType?: ResponseType;
}

/** Options for `POST /batch`. */
export interface BatchOptions {
  urls: string[];
  format?: Format;
  width?: number;
  height?: number;
  quality?: number;
  fullPage?: boolean;
  responseType?: "base64" | "paths" | "image_urls";
}

/** Options for `GET /diff`. */
export interface DiffOptions {
  before: string;
  after: string;
  width?: number;
  height?: number;
  threshold?: number;
  responseType?: DiffResponseType;
}

export interface PageMetadata {
  title?: string;
  description?: string;
  og_title?: string;
  og_image?: string;
  og_description?: string;
  favicon?: string;
  http_status?: number;
}

/** JSON response returned when `responseType` is `json` or `base64`. */
export interface ScreenshotJsonResult {
  url: string;
  format: string;
  width?: number;
  height?: number;
  cached: boolean;
  /** ISO timestamp, or `null` for cache hits. */
  takenAt: string | null;
  image?: string;
  content?: string;
  metadata?: PageMetadata;
  storagePath?: string;
}

export interface BatchItemResult {
  url: string;
  format?: string;
  cached?: boolean;
  image?: string;
  storagePath?: string;
  error?: string;
}

export interface BatchResult {
  total: number;
  results: BatchItemResult[];
}

export interface DiffResult {
  before: string;
  after: string;
  width?: number;
  height?: number;
  changed_pixels: number;
  total_pixels?: number;
  diff_percent: number;
  has_changes: boolean;
  image?: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: string;
  completedAt?: string;
  result?: ScreenshotJsonResult;
  error?: string;
}

export interface HealthResult {
  status: string;
  browserPool: { size: number; available: number };
  cache: string;
}

/** Configuration for the `SnapshotFlow` client. */
export interface SnapshotFlowConfig {
  /** API key, sent as the `X-Api-Key` header (or `api_key` query for generated URLs). */
  apiKey: string;
  /** Base API URL. Defaults to the production endpoint. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default: 60000. */
  timeoutMs?: number;
  /** Max retries on 429 / 5xx / network errors. Default: 2. */
  maxRetries?: number;
  /** Custom fetch implementation (useful for tests or proxies). */
  fetch?: typeof fetch;
  /** Extra headers added to every request. */
  defaultHeaders?: Record<string, string>;
}
