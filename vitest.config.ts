import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // types.ts is interface-only (no runtime code) — exclude from coverage.
      exclude: ["src/types.ts"],
      reporter: ["text", "html"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
