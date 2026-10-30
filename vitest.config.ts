import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Only tests/: the Playwright tests in e2e/ run with `npx playwright test`.
export default defineConfig({
  // The "@/" paths of tsconfig.json, for the tests of the server actions (#75).
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    // next-intl imports "next/server" with no extension, which plain Node cannot resolve: Vite resolves it.
    server: { deps: { inline: ["next-intl"] } },
  },
});
