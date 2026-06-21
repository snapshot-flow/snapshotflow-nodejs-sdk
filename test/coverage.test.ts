import { describe, expect, it, vi } from "vitest";
// Import via the package entry point to exercise src/index.ts re-exports.
import {
  SnapshotFlow,
  ConfigError,
  NetworkError,
  SnapshotFlowError,
  TakeOptions,
} from "../src/index.js";

function res(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const isString = typeof body === "string";
  return new Response(isString ? (body as string) : JSON.stringify(body), {
    status,
    headers: { "content-type": isString ? "text/plain" : "application/json", ...headers },
  });
}

function client(fetchImpl: typeof fetch, extra = {}) {
  return new SnapshotFlow({ apiKey: "k", baseUrl: "https://api.test", fetch: fetchImpl, ...extra });
}

describe("config", () => {
  it("throws ConfigError without apiKey", () => {
    expect(() => new SnapshotFlow({ apiKey: "" })).toThrow(ConfigError);
  });
});

describe("generateUrl", () => {
  it("builds a URL with the api key in the query", () => {
    const url = client(vi.fn() as unknown as typeof fetch).generateUrl(
      TakeOptions.url("https://x.com").fullPage(true),
    );
    expect(url).toContain("https://api.test/screenshot?");
    expect(url).toContain("api_key=k");
    expect(url).toContain("full_page=true");
  });
});

describe("takeUrl", () => {
  it("returns the plain-text download URL", async () => {
    const fetchImpl = vi.fn(async (u: string) => {
      expect(u).toContain("response_type=url");
      return res("https://files.test/abc.png", 200);
    }) as unknown as typeof fetch;
    const out = await client(fetchImpl).takeUrl({ url: "https://x.com" });
    expect(out).toBe("https://files.test/abc.png");
  });
});

describe("diff / getJob / health", () => {
  it("diff returns stats", async () => {
    const fetchImpl = vi.fn(async (u: string) => {
      expect(u).toContain("/diff?");
      expect(u).toContain("response_type=base64");
      return res({
        before: "a",
        after: "b",
        changed_pixels: 1,
        diff_percent: 0.1,
        has_changes: true,
      });
    }) as unknown as typeof fetch;
    const out = await client(fetchImpl).diff({
      before: "a",
      after: "b",
      threshold: 0.2,
      width: 800,
    });
    expect(out.has_changes).toBe(true);
  });

  it("getJob and health parse JSON", async () => {
    const fetchImpl = vi.fn(async (u: string) =>
      u.includes("/health")
        ? res({ status: "ok", browserPool: { size: 1, available: 1 }, cache: "redis" })
        : res({ id: "j1", status: "done", createdAt: "now" }),
    ) as unknown as typeof fetch;
    const c = client(fetchImpl);
    expect((await c.getJob("j1")).status).toBe("done");
    expect((await c.health()).status).toBe("ok");
  });
});

describe("error bodies", () => {
  it("falls back to status text on a non-JSON error body", async () => {
    const fetchImpl = vi.fn(async () => res("boom", 400)) as unknown as typeof fetch;
    await expect(
      client(fetchImpl, { maxRetries: 0 }).take({ url: "https://x.com" }),
    ).rejects.toThrow(SnapshotFlowError);
  });

  it("wraps a thrown fetch error as NetworkError", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connection reset");
    }) as unknown as typeof fetch;
    await expect(
      client(fetchImpl, { maxRetries: 0 }).take({ url: "https://x.com" }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it("maps an aborted request to a TimeoutError", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    }) as unknown as typeof fetch;
    await expect(
      client(fetchImpl, { maxRetries: 0 }).take({ url: "https://x.com" }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("TakeOptions covers every builder method", () => {
  it("sets all remaining fields", () => {
    const o = TakeOptions.from({ url: "https://x.com" })
      .viewportMobile(true)
      .omitBackground(true)
      .imageWidth(400)
      .imageHeight(300)
      .delay(100)
      .waitUntil("networkidle0")
      .waitForSelector(".ready")
      .reducedMotion(true)
      .mediaType("print")
      .timezone("Europe/Paris")
      .userAgent("ua")
      .headers({ A: "b" })
      .cookies([{ name: "s", value: "1" }])
      .styles("*{}")
      .scripts("void 0")
      .click(".btn")
      .blockTrackers(true)
      .blockRequests(["*.gif"])
      .pdfPrintBackground(true)
      .pdfLandscape(true)
      .pdfPaperFormat("a3")
      .extractContent(true)
      .contentFormat("text")
      .metadata(true)
      .async(true)
      .webhookUrl("https://hook")
      .cache(false)
      .toObject();

    expect(o.mediaType).toBe("print");
    expect(o.pdfPaperFormat).toBe("a3");
    expect(o.cookies).toEqual([{ name: "s", value: "1" }]);
  });
});

describe("ScreenshotResult helpers", () => {
  it("exposes buffer, blob, base64 and save", async () => {
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { readFile, unlink } = await import("node:fs/promises");

    const png = new Uint8Array([137, 80, 78, 71]);
    const fetchImpl = vi.fn(
      async () => new Response(png, { status: 200, headers: { "content-type": "image/png" } }),
    ) as unknown as typeof fetch;

    const shot = await client(fetchImpl).take({ url: "https://x.com" });
    expect(shot.blob()).toBeInstanceOf(Blob);
    expect(shot.toBase64()).toBe(`data:image/png;base64,${Buffer.from(png).toString("base64")}`);

    const file = join(tmpdir(), `sf-${Date.now()}.png`);
    await shot.save(file);
    expect(await readFile(file)).toEqual(Buffer.from(png));
    await unlink(file);
  });
});

describe("webhook static + edge", () => {
  it("rejects malformed hex without throwing", () => {
    const t = Math.floor(Date.now() / 1000);
    // 'zz' is not valid hex — must return false, not throw.
    const ok = SnapshotFlow.verifyWebhook({
      rawBody: "{}",
      signatureHeader: `t=${t},sha256=zz`,
      secret: "s",
    });
    expect(ok).toBe(false);
  });
});
