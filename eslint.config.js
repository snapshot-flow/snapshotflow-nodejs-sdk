import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

// Flat config. Keep it minimal: recommended TS rules + Prettier (formatting off).
export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage"] },
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
