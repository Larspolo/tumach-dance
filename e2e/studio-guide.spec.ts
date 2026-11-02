// The guide for Nina (#45): three parts in each language, a picture or a button name for each step.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };

const MESSAGES = { en, nl };

for (const [locale, m] of Object.entries(MESSAGES)) {
  test(`/${locale}/studio-guide shows the three parts with their pictures`, async ({ page }) => {
    await page.goto(`/${locale}/studio-guide`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.StudioGuide.title);
    for (const title of [m.StudioGuide.loginTitle, m.StudioGuide.installTitle, m.StudioGuide.pushTitle])
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    // The install steps name the button of the browser; the steps of the app have a picture.
    await expect(page.getByText(m.StudioGuide.installIphone)).toBeVisible();
    await expect(page.getByText(m.StudioGuide.installAndroid)).toBeVisible();
    for (const img of await page.locator("main img").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
    }
    expect(await page.locator("main img").count()).toBe(4);
  });
}

test.describe("in Dutch", () => {
  test.use({ locale: "nl-NL" });
  test("the login page links to the guide in the language of the page", async ({ page }) => {
    await page.goto("/studio/login");
    await page.getByRole("link", { name: nl.StudioGuide.link }).click();
    await expect(page).toHaveURL(/\/nl\/studio-guide$/);
  });
});
