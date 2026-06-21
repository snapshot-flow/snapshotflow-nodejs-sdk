import { describe, expect, it, vi } from "vitest";
import { SnapshotFlow } from "../src/client.js";
import { QuotaExceededError, TimeoutError } from "../src/errors.js";

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeClient(fetchImpl: typeof fetch, extra = {}) {
  return new SnapshotFlow({
    apiKey: "test-key",
    baseUrl: "https://api.test",
    maxRetries: 1,
    fetch: fetchImpl,
    ...extra,
  });
}

describe("take", () => {
  it("returns a binary result with helpers", async () => {
    const png = new Uint8Array([1, 2, 3, 4]);
    const fetchImpl = vi.fn(
      async () =>
        new Response(png, {
          status: 200,
          headers: { "content-type": "image/png", "x-cache": "HIT" },
        }),
    ) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    const result = await client.take({ url: "https://example.com" });

    expect(result.contentType).toBe("image/png");
    expect(result.cached).toBe(true);
    expect(result.buffer).toEqual(Buffer.from(png));
    expect(result.toBase64()).toContain("data:image/png;base64,");

    const calledUrl = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(calledUrl).toContain("/screenshot?");
    expect(calledUrl).toContain("url=https%3A%2F%2Fexample.com");
  });
});

describe("takeJson", () => {
  it("forces response_type=json and parses the body", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("response_type=json");
      return jsonResponse({ url: "https://x.com", format: "png", cached: false, takenAt: "now" });
    }) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    const res = await client.takeJson({ url: "https://x.com" });
    expect(res.format).toBe("png");
  });
});

describe("batch", () => {
  it("POSTs a snake_case body", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        urls: ["https://a.com"],
        full_page: true,
        response_type: "base64",
      });
      return jsonResponse({ total: 1, results: [] });
    }) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    const res = await client.batch({
      urls: ["https://a.com"],
      fullPage: true,
      responseType: "base64",
    });
    expect(res.total).toBe(1);
  });
});

describe("error handling", () => {
  it("maps the backend `error` field to typed errors", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "RATE_LIMITED", message: "slow down" }, 429),
    ) as unknown as typeof fetch;

    const client = makeClient(fetchImpl, { maxRetries: 0 });
    await expect(client.take({ url: "https://x.com" })).rejects.toMatchObject({
      name: "RateLimitError",
      code: "RATE_LIMITED",
      message: "slow down",
    });
  });

  it("maps QUOTA_EXCEEDED and exposes extra details", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: "QUOTA_EXCEEDED", message: "used up", quota: { used: 200, limit: 200 } },
        402,
      ),
    ) as unknown as typeof fetch;

    const client = makeClient(fetchImpl, { maxRetries: 0 });
    try {
      await client.take({ url: "https://x.com" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(QuotaExceededError);
      expect((err as QuotaExceededError).details).toEqual({ quota: { used: 200, limit: 200 } });
    }
  });

  it("retries retryable statuses then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls === 1) return jsonResponse({ code: "POOL_EXHAUSTED" }, 503);
      return new Response(new Uint8Array([9]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }) as unknown as typeof fetch;

    const client = makeClient(fetchImpl, { maxRetries: 2 });
    const result = await client.take({ url: "https://x.com" });
    expect(calls).toBe(2);
    expect(result.buffer).toEqual(Buffer.from([9]));
  });
});

describe("waitForJob", () => {
  it("polls until done", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      return jsonResponse({
        id: "j1",
        status: calls < 2 ? "processing" : "done",
        createdAt: "now",
      });
    }) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    const job = await client.waitForJob("j1", { intervalMs: 1, timeoutMs: 1000 });
    expect(job.status).toBe("done");
  });

  it("throws TimeoutError when the job never finishes", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ id: "j1", status: "processing", createdAt: "now" }),
    ) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    await expect(client.waitForJob("j1", { intervalMs: 1, timeoutMs: 5 })).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });
});

describe("no mutation of caller's options", () => {
  it("takeJson does not mutate the passed object", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ url: "https://x.com", format: "png", cached: false, takenAt: "now" }),
    ) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    const opts = { url: "https://x.com" };
    await client.takeJson(opts);
    expect(opts).toEqual({ url: "https://x.com" }); // responseType not added
  });

  it("takeAsync does not mutate the passed object", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ job_id: "j1", status: "pending" }, 202),
    ) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    const opts = { url: "https://x.com" };
    const res = await client.takeAsync(opts);
    expect(res).toEqual({ jobId: "j1", status: "pending" });
    expect(opts).toEqual({ url: "https://x.com" }); // async not added
  });
});
