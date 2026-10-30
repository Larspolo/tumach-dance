import { defineConfig, devices } from "@playwright/test";
import webpush from "web-push";

// The slow tests: the home page on a phone and a laptop, the login of the studio app on a phone. Screenshots go to out/ (scratch).
// PLAYWRIGHT_CHROMIUM: a Chromium that is already installed (the cloud image: /opt/pw-browsers/chromium).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;
// Throwaway VAPID keys for the push test (#25), new at each run.
const vapid = webpush.generateVAPIDKeys();

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  reporter: "list",
  // One worker: two studio logins at once replace the code of each other (#31).
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    launchOptions: { executablePath },
  },
  projects: [
    // One login for all tests that need a session (`e2e/studio-session.ts`, #23).
    { name: "setup", testMatch: /\.setup\.ts$/ },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      dependencies: ["setup"],
    },
    {
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    // The stub of the GitHub API of the page "For Nina" (#68).
    { command: "node e2e/github-stub.mjs", url: "http://localhost:3101/__comments", reuseExistingServer: false },
    {
      command: "npm run build && npm run start -- -p 3100",
      url: "http://localhost:3100/en",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // The login test (#19): a test email, the emails in a file (the code), and a throwaway database in out/.
      env: {
        STUDIO_EMAIL: "nina@example.test",
        EMAIL_TRANSPORT: "log",
        EMAIL_LOG_FILE: "out/e2e/email.log",
        DATABASE_PATH: "out/e2e/tumach.db",
        BETTER_AUTH_URL: "http://localhost:3100",
        BETTER_AUTH_SECRET: "e2e-only-secret-of-the-throwaway-test-database",
        VAPID_PUBLIC_KEY: vapid.publicKey,
        VAPID_PRIVATE_KEY: vapid.privateKey,
        VAPID_SUBJECT: "mailto:test@example.test",
        GITHUB_API_URL: "http://localhost:3101",
        GITHUB_TOKEN: "e2e-only-token",
        GITHUB_REPO: "owner/repo",
      },
    },
  ],
});
