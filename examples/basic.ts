/**
 * Runnable example. Build the package first (`npm run build`), then:
 *   SNAPSHOTFLOW_API_KEY=... npx tsx examples/basic.ts
 */

import { SnapshotFlow, TakeOptions } from "../src/index.js";

const client = new SnapshotFlow({
  apiKey: process.env.SNAPSHOTFLOW_API_KEY ?? "your-api-key",
  baseUrl: process.env.SNAPSHOTFLOW_BASE_URL ?? "http://localhost:3000",
});

async function main() {
  // 1. Generate a URL for an <img> tag (no network call).
  const imgUrl = client.generateUrl({ url: "https://example.com", fullPage: true });
  console.log("img url:", imgUrl);

  // 2. Download a screenshot to disk.
  const shot = await client.take(
    TakeOptions.url("https://example.com").width(1440).deviceScaleFactor(2),
  );
  await shot.save("example.png");
  console.log("saved example.png, cached:", shot.cached);

  // 3. Screenshot + page text for an LLM.
  const json = await client.takeJson({
    url: "https://example.com",
    responseType: "base64",
    extractContent: true,
    contentFormat: "markdown",
  });
  console.log("content length:", json.content?.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
