/**
 * Fluent builder for screenshot options.
 *
 * Equivalent to passing a plain options object — use whichever you prefer:
 *   TakeOptions.url("https://example.com").fullPage(true).format("jpeg")
 *   { url: "https://example.com", fullPage: true, format: "jpeg" }
 */

import type {
  ContentFormat,
  Cookie,
  Format,
  MediaType,
  PdfPaperFormat,
  ResponseType,
  ScreenshotOptions,
  WaitUntil,
} from "./types.js";

export class TakeOptions {
  private readonly opts: ScreenshotOptions;

  private constructor(init: ScreenshotOptions) {
    this.opts = init;
  }

  static url(url: string): TakeOptions {
    return new TakeOptions({ url });
  }
  static html(html: string): TakeOptions {
    return new TakeOptions({ html });
  }
  static from(options: ScreenshotOptions): TakeOptions {
    return new TakeOptions({ ...options });
  }

  private set<K extends keyof ScreenshotOptions>(key: K, value: ScreenshotOptions[K]): this {
    this.opts[key] = value;
    return this;
  }

  // Viewport
  width(v: number) {
    return this.set("width", v);
  }
  height(v: number) {
    return this.set("height", v);
  }
  deviceScaleFactor(v: number) {
    return this.set("deviceScaleFactor", v);
  }
  viewportMobile(v = true) {
    return this.set("viewportMobile", v);
  }

  // Capture
  format(v: Format) {
    return this.set("format", v);
  }
  quality(v: number) {
    return this.set("quality", v);
  }
  fullPage(v = true) {
    return this.set("fullPage", v);
  }
  omitBackground(v = true) {
    return this.set("omitBackground", v);
  }
  selector(v: string) {
    return this.set("selector", v);
  }
  clip(x: number, y: number, width: number, height: number) {
    return this.set("clipX", x).set("clipY", y).set("clipWidth", width).set("clipHeight", height);
  }
  imageWidth(v: number) {
    return this.set("imageWidth", v);
  }
  imageHeight(v: number) {
    return this.set("imageHeight", v);
  }

  // Timing
  delay(v: number) {
    return this.set("delay", v);
  }
  waitUntil(v: WaitUntil) {
    return this.set("waitUntil", v);
  }
  waitForSelector(v: string) {
    return this.set("waitForSelector", v);
  }

  // Emulation
  darkMode(v = true) {
    return this.set("darkMode", v);
  }
  reducedMotion(v = true) {
    return this.set("reducedMotion", v);
  }
  mediaType(v: MediaType) {
    return this.set("mediaType", v);
  }
  timezone(v: string) {
    return this.set("timezone", v);
  }
  geolocation(latitude: number, longitude: number, accuracy?: number) {
    this.set("geolocationLatitude", latitude).set("geolocationLongitude", longitude);
    if (accuracy !== undefined) this.set("geolocationAccuracy", accuracy);
    return this;
  }
  userAgent(v: string) {
    return this.set("userAgent", v);
  }

  // Injection & interaction
  headers(v: Record<string, string>) {
    return this.set("headers", v);
  }
  cookies(v: Cookie[]) {
    return this.set("cookies", v);
  }
  styles(v: string) {
    return this.set("styles", v);
  }
  scripts(v: string) {
    return this.set("scripts", v);
  }
  hideSelectors(v: string[]) {
    return this.set("hideSelectors", v);
  }
  click(v: string) {
    return this.set("click", v);
  }

  // Blocking
  blockAds(v = true) {
    return this.set("blockAds", v);
  }
  blockTrackers(v = true) {
    return this.set("blockTrackers", v);
  }
  blockCookieBanners(v = true) {
    return this.set("blockCookieBanners", v);
  }
  blockRequests(v: string[]) {
    return this.set("blockRequests", v);
  }

  // PDF
  pdfPrintBackground(v = true) {
    return this.set("pdfPrintBackground", v);
  }
  pdfLandscape(v = true) {
    return this.set("pdfLandscape", v);
  }
  pdfPaperFormat(v: PdfPaperFormat) {
    return this.set("pdfPaperFormat", v);
  }

  // Content & metadata
  extractContent(v = true) {
    return this.set("extractContent", v);
  }
  contentFormat(v: ContentFormat) {
    return this.set("contentFormat", v);
  }
  metadata(v = true) {
    return this.set("metadata", v);
  }

  // Async / webhook
  async(v = true) {
    return this.set("async", v);
  }
  webhookUrl(v: string) {
    return this.set("webhookUrl", v);
  }
  externalIdentifier(v: string) {
    return this.set("externalIdentifier", v);
  }
  webhookErrors(v: boolean) {
    return this.set("webhookErrors", v);
  }

  // Cache & response
  cache(v: boolean) {
    return this.set("cache", v);
  }
  responseType(v: ResponseType) {
    return this.set("responseType", v);
  }

  /** Return a plain options object (a copy). */
  toObject(): ScreenshotOptions {
    return { ...this.opts };
  }
}

/** Accept either a builder or a plain object anywhere options are needed. */
export type OptionsInput = TakeOptions | ScreenshotOptions;

/**
 * Always return a fresh copy so the SDK never mutates a caller's object.
 * (`TakeOptions.toObject()` already copies.)
 */
export function resolveOptions(input: OptionsInput): ScreenshotOptions {
  return input instanceof TakeOptions ? input.toObject() : { ...input };
}
