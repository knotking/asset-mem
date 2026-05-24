import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * Console guardrails: use createLogger() from src/lib/logger.ts.
 * @see docs/CLIENT_LOGGING.md
 */
export default defineConfig(
  {
    ignores: ["dist/**", "node_modules/**", "__tests__/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
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
