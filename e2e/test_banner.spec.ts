import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

// The web server of playwright.config.ts starts with no SITE_ENV: the preview, with the banner.
test("the preview shows the test site banner", async ({ page }, testInfo) => {
  await page.goto("/en");
  await expect(page.getByTestId("test-banner")).toHaveText(en.TestBanner.text);
  await page.screenshot({ path: `out/screenshots/test-banner-${testInfo.project.name}.png` });
});
