import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    testTimeout: 15000,
    // These directories use node:test (not vitest) and are run separately via node --test
    exclude: [
      "**/node_modules/**",
      "tests/import/**",
      "tests/metrics/**",
      "tests/onboarding/**",
      "tests/reports/**",
      "tests/security/**",
      "tests/support/**",
      "tests/utils/**",
    ],
  },
});
