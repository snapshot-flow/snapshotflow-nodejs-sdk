# AGENTS.md

Guidance for AI agents working in this repository. Keep changes simple and minimal.

## What this is

The official TypeScript/Node.js SDK for the SnapshotFlow screenshot API. It is a
**thin HTTP wrapper** — there is no browser/Puppeteer logic here. All rendering
happens on the backend (`screenshot-backend`). The SDK only builds URLs, serializes
options, sends requests, and types the responses.

## File map (read in this order)

```
src/
├── types.ts    # All public types. Option fields are camelCase. START HERE.
├── errors.ts   # Typed error classes + API-code -> class mapping.
├── url.ts      # Pure functions: serialize options, build/sign URLs, verify webhooks.
├── http.ts     # fetch wrapper: timeout, retries, error parsing. No business logic.
├── options.ts  # TakeOptions fluent builder (mirrors the fields in types.ts).
├── client.ts   # SnapshotFlow class — one method per API endpoint.
└── index.ts    # Public exports. Anything not re-exported here is internal.
```

## Conventions

- **Language:** TypeScript, `strict: true`. All code comments in English.
- **Naming:** SDK options are camelCase; the API uses snake_case. Conversion is
  automatic and mechanical in `url.ts::serializeOptions` (`toSnakeCase`). Do not
  hand-maintain a key map unless a value needs special serialization.
- **Special serialization** (in `url.ts`): `html` -> base64; `headers`/`cookies`
  -> JSON; `hideSelectors`/`blockRequests` -> comma-joined.
- **No runtime dependencies.** Use Node built-ins only (`node:crypto`, `node:fs`,
  global `fetch`). Keep it that way.
- **Errors:** never throw plain strings. Use the classes in `errors.ts`.

## When you add a new screenshot parameter

The backend is the source of truth (`screenshot-backend/README.md`). To add a param:

1. Add the camelCase field to `ScreenshotOptions` in `src/types.ts`.
2. If it needs special serialization, handle it in `src/url.ts::serializeOptions`;
   otherwise the automatic snake_case conversion covers it.
3. Add a matching builder method in `src/options.ts`.
4. Add/extend a test in `test/`.

That's it — `client.ts` does not need changes for new capture params.

## Commands

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # tsup -> dist (ESM + CJS + .d.ts)
```

## Tests

`test/` uses Vitest with a mocked `fetch` (inject via the `fetch` config option).
Do not make real network calls in unit tests.
