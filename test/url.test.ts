import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { buildUrl, serializeOptions, verifyWebhook } from "../src/url.js";

describe("serializeOptions", () => {
  it("converts camelCase keys to snake_case", () => {
    const out = serializeOptions({ deviceScaleFactor: 2, fullPage: true });
    expect(out.device_scale_factor).toBe("2");
    expect(out.full_page).toBe("true");
  });

  it("serializes new params (externalIdentifier, webhookErrors)", () => {
    const out = serializeOptions({ externalIdentifier: "order_42", webhookErrors: false });
    expect(out.external_identifier).toBe("order_42");
    expect(out.webhook_errors).toBe("false");
  });

  it("base64-encodes html", () => {
    const out = serializeOptions({ html: "<h1>hi</h1>" });
    expect(out.html).toBe(Buffer.from("<h1>hi</h1>", "utf8").toString("base64"));
  });

  it("JSON-encodes headers and cookies", () => {
    const out = serializeOptions({
      headers: { Authorization: "Bearer x" },
      cookies: [{ name: "s", value: "1" }],
    });
    expect(JSON.parse(out.headers!)).toEqual({ Authorization: "Bearer x" });
    expect(JSON.parse(out.cookies!)).toEqual([{ name: "s", value: "1" }]);
  });

  it("comma-joins array params", () => {
    const out = serializeOptions({ hideSelectors: [".a", ".b"], blockRequests: ["*.png"] });
    expect(out.hide_selectors).toBe(".a,.b");
    expect(out.block_requests).toBe("*.png");
  });

  it("skips undefined values", () => {
    const out = serializeOptions({ url: "https://x.com", selector: undefined });
    expect(out).not.toHaveProperty("selector");
  });
});

describe("buildUrl", () => {
  it("appends api_key, no signature", () => {
    const url = buildUrl({
      baseUrl: "https://api.test/",
      path: "/screenshot",
      params: serializeOptions({ url: "https://x.com" }),
      apiKey: "key1",
    });
    expect(url).toContain("https://api.test/screenshot?");
    expect(url).toContain("api_key=key1");
    expect(url).not.toContain("signature=");
  });
});

describe("verifyWebhook", () => {
  function sign(secret: string, body: string, t: number) {
    const sha256 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    return { header: `t=${t},sha256=${sha256}`, sha256 };
  }

  const secret = "whsec";
  const rawBody = '{"event":"screenshot.done","job_id":"1"}';

  it("accepts a valid, fresh signature", () => {
    const t = Math.floor(Date.now() / 1000);
    const { header } = sign(secret, rawBody, t);
    expect(verifyWebhook({ rawBody, signatureHeader: header, secret })).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyWebhook({ rawBody, signatureHeader: `t=${t},sha256=deadbeef`, secret })).toBe(
      false,
    );
  });

  it("rejects a stale signature", () => {
    const t = Math.floor(Date.now() / 1000) - 1000;
    const { header } = sign(secret, rawBody, t);
    expect(verifyWebhook({ rawBody, signatureHeader: header, secret })).toBe(false);
  });

  it("can skip the freshness window with toleranceSec=0", () => {
    const t = Math.floor(Date.now() / 1000) - 100000;
    const { header } = sign(secret, rawBody, t);
    expect(verifyWebhook({ rawBody, signatureHeader: header, secret, toleranceSec: 0 })).toBe(true);
  });

  it("rejects a malformed header", () => {
    expect(verifyWebhook({ rawBody, signatureHeader: "garbage", secret })).toBe(false);
  });
});
