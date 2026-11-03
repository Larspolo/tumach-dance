// The offline line of the studio app on a phone (#747): it shows while the browser has no internet, in English and Dutch.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION, viewport: { width: 390, height: 844 } });

for (const [locale, texts] of [
  ["en-GB", en],
  ["nl-NL", nl],
] as const) {
  test.describe(locale, () => {
    test.use({ locale });

    test("the offline line shows the time and goes away online", async ({ page, context }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
      await page.goto("/studio");
      const start = texts.StudioHome.offline.split("{time}")[0];
      const line = page.getByRole("status").filter({ hasText: start });
      await expect(line).toHaveCount(0);
      await context.setOffline(true);
      await expect(line).toBeVisible();
      await expect(line).toHaveText(/\d{2}:\d{2}/);
      await page.screenshot({ path: `out/e2e/studio-offline-${locale}.png` });
      await context.setOffline(false);
      await expect(line).toHaveCount(0);
    });
  });
}
