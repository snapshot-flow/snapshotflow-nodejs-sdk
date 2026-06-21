/**
 * Thin HTTP layer: timeout, retries with exponential backoff + jitter, and
 * conversion of API error responses into typed errors.
 */

import { NetworkError, TimeoutError, errorFromResponse } from "./errors.js";

export interface HttpClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
  fetchImpl: typeof fetch;
  defaultHeaders: Record<string, string>;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  const base = 300 * 2 ** attempt; // 300ms, 600ms, 1200ms, ...
  return base + Math.floor(Math.random() * 200); // jitter
}

export class HttpClient {
  constructor(private readonly opts: HttpClientOptions) {}

  /** Perform a request with retries. Returns the raw Response on success. */
  async request(
    path: string,
    init: { method?: string; query?: string; body?: unknown } = {},
  ): Promise<Response> {
    const url =
      `${this.opts.baseUrl.replace(/\/$/, "")}${path}` + (init.query ? `?${init.query}` : "");

    const headers: Record<string, string> = {
      "X-Api-Key": this.opts.apiKey,
      ...this.opts.defaultHeaders,
    };
    let body: string | undefined;
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.body);
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);

      try {
        const res = await this.opts.fetchImpl(url, {
          method: init.method ?? "GET",
          headers,
          body,
          signal: controller.signal,
        });

        if (res.ok) return res;

        if (RETRYABLE_STATUS.has(res.status) && attempt < this.opts.maxRetries) {
          await sleep(backoffDelay(attempt, res.headers.get("retry-after")));
          continue;
        }

        throw await toApiError(res);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new TimeoutError(
            `Request to ${path} timed out after ${this.opts.timeoutMs}ms`,
            "TIMEOUT",
          );
        } else if (isTypedApiError(err)) {
          throw err; // do not retry typed API errors
        } else {
          lastError = new NetworkError(
            `Network request to ${path} failed: ${(err as Error).message}`,
          );
        }

        if (attempt < this.opts.maxRetries) {
          await sleep(backoffDelay(attempt, null));
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new NetworkError(`Request to ${path} failed`);
  }
}

function isTypedApiError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && "httpStatus" in err;
}

async function toApiError(res: Response): Promise<Error> {
  const requestId = res.headers.get("x-request-id") ?? undefined;
  let code: string | undefined;
  let message: string | undefined;
  let details: Record<string, unknown> | undefined;
  try {
    // Backend shape: { error: "MACHINE_CODE", message: "human text", ...extra }.
    // `code` is checked first only for forward-compatibility.
    const data = (await res.json()) as Record<string, unknown>;
    code = (data.code as string) ?? (data.error as string);
    message = (data.message as string) ?? (data.error as string);
    const { error: _e, message: _m, code: _c, ...rest } = data;
    if (Object.keys(rest).length > 0) details = rest;
  } catch {
    // body was not JSON; fall back to status text
    message = res.statusText;
  }
  return errorFromResponse(res.status, code, message, requestId, details);
}
