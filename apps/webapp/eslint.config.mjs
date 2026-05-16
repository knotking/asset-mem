import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * Console guardrails: use createLogger() from src/lib/logger.ts.
 * @see docs/CLIENT_LOGGING.md
 *
 * Intentionally minimal (no full next/core-web-vitals) to avoid unrelated legacy noise.
 * Run `npm run typecheck` for TypeScript; expand this config over time if desired.
 */
export default defineConfig(
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      "scripts/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.base],
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["src/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  }
);
