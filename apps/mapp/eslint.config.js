const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");

/**
 * Console guardrails: use createLogger() from lib/logger.ts.
 * @see docs/CLIENT_LOGGING.md
 */
module.exports = defineConfig(
  {
    ignores: ["node_modules/**", ".expo/**", "dist/**", "__tests__/**", "__mocks__/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.base],
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  }
);
