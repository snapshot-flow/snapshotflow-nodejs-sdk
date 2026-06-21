/**
 * SnapshotFlow API client.
 *
 * Thin, typed wrapper over the HTTP API. No browser logic lives here — all
 * rendering happens on the backend.
 */

import { writeFile } from "node:fs/promises";
import { ConfigError, SnapshotFlowError, TimeoutError } from "./errors.js";
import { HttpClient } from "./http.js";
import { resolveOptions, type OptionsInput } from "./options.js";
import {
  buildUrl,
  serializeOptions,
  toQueryString,
  verifyWebhook,
  type VerifyWebhookArgs,
} from "./url.js";
import type {
  BatchOptions,
  BatchResult,
  DiffOptions,
  DiffResult,
  HealthResult,
  Job,
  JobStatus,
  ScreenshotJsonResult,
  SnapshotFlowConfig,
} from "./types.js";

// Production backend (Railway). Override via `baseUrl` once a custom domain is live.
const DEFAULT_BASE_URL = "https://screenshot-backend-production-c32d.up.railway.app";

/** Binary screenshot result with convenience helpers. */
export class ScreenshotResult {
  constructor(
    readonly buffer: Buffer,
    readonly contentType: string,
    readonly cached: boolean,
    readonly etag?: string,
  ) {}

  blob(): Blob {
    return new Blob([Uint8Array.from(this.buffer)], { type: this.contentType });
  }
  toBase64(): string {
    return `data:${this.contentType};base64,${this.buffer.toString("base64")}`;
  }
  async save(filePath: string): Promise<void> {
    await writeFile(filePath, this.buffer);
  }
}

export class SnapshotFlow {
  private readonly http: HttpClient;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: SnapshotFlowConfig) {
    if (!config.apiKey) throw new ConfigError("`apiKey` is required");
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.http = new HttpClient({
      baseUrl: this.baseUrl,
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs ?? 60_000,
      maxRetries: config.maxRetries ?? 2,
      fetchImpl: config.fetch ?? fetch,
      defaultHeaders: config.defaultHeaders ?? {},
    });
  }

  /**
   * Build a screenshot URL without making a request (e.g. for `<img src>`).
   * The API key is included as a query param — see the note on `buildUrl`.
   */
  generateUrl(options: OptionsInput): string {
    return buildUrl({
      baseUrl: this.baseUrl,
      path: "/screenshot",
      params: serializeOptions(resolveOptions(options)),
      apiKey: this.apiKey,
    });
  }

  /** Capture a screenshot and return the binary image/PDF. */
  async take(options: OptionsInput): Promise<ScreenshotResult> {
    const query = toQueryString(serializeOptions(resolveOptions(options)));
    const res = await this.http.request("/screenshot", { query });
    const buffer = Buffer.from(await res.arrayBuffer());
    return new ScreenshotResult(
      buffer,
      res.headers.get("content-type") ?? "application/octet-stream",
      res.headers.get("x-cache") === "HIT",
      res.headers.get("etag") ?? undefined,
    );
  }

  /**
   * Capture and return a JSON result (metadata, extracted content, base64 image).
   * Only `json` and `base64` produce JSON; any other value (including `url`) is
   * coerced to `json`. Use `takeUrl()` for the `url` response type.
   */
  async takeJson(options: OptionsInput): Promise<ScreenshotJsonResult> {
    const opts = resolveOptions(options); // copy — never mutates caller's object
    if (opts.responseType !== "base64") opts.responseType = "json";
    const query = toQueryString(serializeOptions(opts));
    const res = await this.http.request("/screenshot", { query });
    return (await res.json()) as ScreenshotJsonResult;
  }

  /**
   * Capture and return a hosted download URL as a string.
   * The backend responds with `text/plain` for `response_type=url`.
   */
  async takeUrl(options: OptionsInput): Promise<string> {
    const opts = resolveOptions(options);
    opts.responseType = "url";
    const query = toQueryString(serializeOptions(opts));
    const res = await this.http.request("/screenshot", { query });
    return (await res.text()).trim();
  }

  /** Capture multiple URLs in one request (max 10). */
  async batch(options: BatchOptions): Promise<BatchResult> {
    const body: Record<string, unknown> = { urls: options.urls };
    if (options.format !== undefined) body.format = options.format;
    if (options.width !== undefined) body.width = options.width;
    if (options.height !== undefined) body.height = options.height;
    if (options.quality !== undefined) body.quality = options.quality;
    if (options.fullPage !== undefined) body.full_page = options.fullPage;
    if (options.responseType !== undefined) body.response_type = options.responseType;

    const res = await this.http.request("/batch", { method: "POST", body });
    return (await res.json()) as BatchResult;
  }

  /**
   * Visual diff of two URLs. Returns pixel stats plus a base64 diff image.
   * (The raw binary `image` response type is not exposed here; this helper
   * always returns structured JSON.)
   */
  async diff(options: DiffOptions): Promise<DiffResult> {
    const params: Record<string, string> = {
      before: options.before,
      after: options.after,
      response_type:
        options.responseType && options.responseType !== "image" ? options.responseType : "base64",
    };
    if (options.width !== undefined) params.width = String(options.width);
    if (options.height !== undefined) params.height = String(options.height);
    if (options.threshold !== undefined) params.threshold = String(options.threshold);

    const res = await this.http.request("/diff", { query: toQueryString(params) });
    return (await res.json()) as DiffResult;
  }

  /** Start an async capture; returns immediately with a job id. */
  async takeAsync(options: OptionsInput): Promise<{ jobId: string; status: JobStatus }> {
    const opts = resolveOptions(options);
    opts.async = true;
    const query = toQueryString(serializeOptions(opts));
    const res = await this.http.request("/screenshot", { query });
    const data = (await res.json()) as { job_id: string; status: JobStatus };
    return { jobId: data.job_id, status: data.status };
  }

  /** Look up the status of an async job. */
  async getJob(jobId: string): Promise<Job> {
    const res = await this.http.request(`/jobs/${encodeURIComponent(jobId)}`);
    return (await res.json()) as Job;
  }

  /** Poll a job until it finishes (status `done` or `failed`) or times out. */
  async waitForJob(
    jobId: string,
    opts: { intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<Job> {
    const interval = opts.intervalMs ?? 1000;
    const timeout = opts.timeoutMs ?? 120_000;
    const deadline = Date.now() + timeout;

    for (;;) {
      const job = await this.getJob(jobId);
      if (job.status === "done" || job.status === "failed") return job;
      if (Date.now() >= deadline) {
        throw new TimeoutError(`Job ${jobId} did not finish within ${timeout}ms`, "TIMEOUT");
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }

  /** Service health check. */
  async health(): Promise<HealthResult> {
    const res = await this.http.request("/health");
    return (await res.json()) as HealthResult;
  }

  /**
   * Verify an incoming webhook. Pass the raw body and the full
   * `X-SnapshotFlow-Signature` header value. See `verifyWebhook` for details.
   */
  static verifyWebhook(args: VerifyWebhookArgs): boolean {
    return verifyWebhook(args);
  }
}

export { SnapshotFlowError };
