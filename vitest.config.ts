import { defineConfig } from "vitest/config";

// Only tests/: the Playwright tests in e2e/ run with `npx playwright test`.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // next-intl imports "next/server" with no extension, which plain Node cannot resolve: Vite resolves it.
    server: { deps: { inline: ["next-intl"] } },
  },
});
