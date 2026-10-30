import { defineConfig, devices } from "@playwright/test";

// The slow tests: the home page on a phone and a laptop. Screenshots go to out/ (scratch).
// PLAYWRIGHT_CHROMIUM: a Chromium that is already installed (the cloud image: /opt/pw-browsers/chromium).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100/en",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
