import { describe, expect, it } from "vitest";
import { TakeOptions, resolveOptions } from "../src/options.js";
import { serializeOptions } from "../src/url.js";

describe("TakeOptions builder", () => {
  it("builds an options object equivalent to the plain form", () => {
    const built = TakeOptions.url("https://example.com")
      .width(1440)
      .deviceScaleFactor(2)
      .fullPage(true)
      .format("jpeg")
      .quality(85)
      .clip(0, 0, 800, 600)
      .darkMode(true)
      .geolocation(48.85, 2.35, 50)
      .blockAds(true)
      .blockCookieBanners(true)
      .hideSelectors([".ads"])
      .externalIdentifier("order_1")
      .webhookErrors(false)
      .responseType("json")
      .toObject();

    expect(built).toEqual({
      url: "https://example.com",
      width: 1440,
      deviceScaleFactor: 2,
      fullPage: true,
      format: "jpeg",
      quality: 85,
      clipX: 0,
      clipY: 0,
      clipWidth: 800,
      clipHeight: 600,
      darkMode: true,
      geolocationLatitude: 48.85,
      geolocationLongitude: 2.35,
      geolocationAccuracy: 50,
      blockAds: true,
      blockCookieBanners: true,
      hideSelectors: [".ads"],
      externalIdentifier: "order_1",
      webhookErrors: false,
      responseType: "json",
    });
  });

  it("serializes builder output to the correct query params", () => {
    const opts = TakeOptions.html("<h1>hi</h1>").format("png").toObject();
    const params = serializeOptions(opts);
    expect(params.format).toBe("png");
    expect(params.html).toBe(Buffer.from("<h1>hi</h1>", "utf8").toString("base64"));
  });

  it("resolveOptions copies plain objects and builder output", () => {
    const plain = { url: "https://x.com" };
    expect(resolveOptions(plain)).not.toBe(plain);
    expect(resolveOptions(plain)).toEqual(plain);

    const builder = TakeOptions.url("https://x.com");
    expect(resolveOptions(builder)).toEqual({ url: "https://x.com" });
  });
});
