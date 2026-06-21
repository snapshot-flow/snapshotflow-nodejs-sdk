import { defineConfig } from "tsup";

// Dual-format build (ESM + CJS) with type declarations.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  treeshake: true,
});
