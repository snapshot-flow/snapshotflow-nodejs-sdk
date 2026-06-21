# snapshotflow

Official TypeScript/Node.js SDK for the [SnapshotFlow](https://snapshotflow.com) screenshot API.

A thin, typed wrapper over the HTTP API — generate screenshot URLs, capture images/PDFs, run batch and visual-diff jobs, and handle async webhooks. No browser or Puppeteer setup; all rendering happens on the backend.

## Install

```bash
npm install snapshotflow
```

Requires Node.js >= 18.

## Quick start

```ts
import { SnapshotFlow, TakeOptions } from "snapshotflow";

const client = new SnapshotFlow({ apiKey: process.env.SNAPSHOTFLOW_API_KEY! });

// Generate a URL for an <img> tag (no network request)
const imgUrl = client.generateUrl({ url: "https://example.com", fullPage: true });

// Download a screenshot
const shot = await client.take({ url: "https://github.com", width: 1440, deviceScaleFactor: 2 });
await shot.save("github.png");
```

You can pass a plain options object or use the fluent `TakeOptions` builder — they are equivalent:

```ts
const options = TakeOptions.url("https://example.com")
  .fullPage(true)
  .format("jpeg")
  .quality(85)
  .darkMode(true)
  .blockAds(true)
  .delay(2000);

const url = client.generateUrl(options);
const result = await client.take(options);
```

## Client config

```ts
new SnapshotFlow({
  apiKey: "...", // required
  baseUrl: "https://screenshot-backend-production-c32d.up.railway.app", // optional, defaults to production
  timeoutMs: 60_000, // optional
  maxRetries: 2, // optional — retries on 429 / 5xx / network errors
  fetch: customFetch, // optional
  defaultHeaders: {}, // optional
});
```

## Methods

| Method                              | Description                                            |
| ----------------------------------- | ------------------------------------------------------ |
| `generateUrl(options)`              | Build a screenshot URL, no request (key in query).     |
| `take(options)`                     | Capture and return binary (`ScreenshotResult`).        |
| `takeJson(options)`                 | Capture and return JSON (metadata / content / base64). |
| `takeUrl(options)`                  | Capture and return a hosted download URL (string).     |
| `batch(options)`                    | Capture up to 10 URLs in one request.                  |
| `diff(options)`                     | Visual diff of two URLs (pixel stats + base64 image).  |
| `takeAsync(options)`                | Start an async job, returns `{ jobId, status }`.       |
| `getJob(id)`                        | Look up job status.                                    |
| `waitForJob(id, opts?)`             | Poll until `done` / `failed` or timeout.               |
| `health()`                          | Service health check.                                  |
| `SnapshotFlow.verifyWebhook({...})` | Verify an incoming webhook signature.                  |

`ScreenshotResult` exposes `buffer`, `contentType`, `cached`, `etag`, and helpers `blob()`, `toBase64()`, `save(path)`.

> Signed screenshot URLs are not provided: the backend does not currently verify them. `generateUrl` puts the API key in the query string, so use it only where exposing the key is acceptable — otherwise prefer `take()`, which sends the key in the `X-Api-Key` header.

## Options

All `/screenshot` options are supported (camelCase in the SDK, converted to the API's snake_case automatically). Highlights: `url` / `html`, `width` / `height` / `deviceScaleFactor`, `format` / `quality` / `fullPage`, `selector` / clip, `delay` / `waitUntil` / `waitForSelector`, `darkMode` / `timezone` / `geolocation*`, `headers` / `cookies` / `styles` / `scripts` / `hideSelectors` / `click`, `blockAds` / `blockTrackers` / `blockCookieBanners` / `blockRequests`, PDF options, `extractContent` / `contentFormat` / `metadata`, `async` / `webhookUrl` / `externalIdentifier` / `webhookErrors`, `cache` / `responseType` (`image` | `json` | `base64` | `url`).

See [`src/types.ts`](./src/types.ts) for the full typed list.

## Errors

The backend returns the machine-readable code in the `error` field; the SDK maps it to a typed class extending `SnapshotFlowError`: `ValidationError`, `InvalidUrlError`, `AuthError`, `QuotaExceededError`, `BlockedUrlError`, `TimeoutError`, `NavigationError`, `SelectorNotFoundError`, `RateLimitError`, `PoolExhaustedError`, plus `NetworkError` and `ConfigError`. Extra body fields (e.g. `quota`) are available on `err.details`.

```ts
import { QuotaExceededError, RateLimitError } from "snapshotflow";

try {
  await client.take({ url: "https://x.com" });
} catch (err) {
  if (err instanceof RateLimitError) {
    // back off and retry later
  } else if (err instanceof QuotaExceededError) {
    console.log(err.details?.quota);
  }
}
```

## Webhooks

Pass the raw request body and the full `X-SnapshotFlow-Signature` header. The SDK parses the `t=...,sha256=...` format, enforces a freshness window (default 300s), and compares in constant time. Verify against the **raw bytes** — never parse-then-re-serialize first.

```ts
import { SnapshotFlow } from "snapshotflow";

const ok = SnapshotFlow.verifyWebhook({
  rawBody, // raw request body string/bytes
  signatureHeader: req.header("x-snapshotflow-signature"),
  secret, // your webhook secret
  // toleranceSec: 300, // optional; 0 disables the freshness check
});
```

## Development

```bash
npm install
npm run check   # format:check + lint + typecheck + test
npm run build
npm run smoke   # build + npm pack contents + ESM/CJS import check
```

## License

MIT
