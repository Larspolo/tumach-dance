// From the studio home, the guide shows a part for each page of the studio app, in en and nl (#779, epic #774).
import { expect, type Page, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { GUIDE_PARTS } from "../src/lib/studio-guide";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION, viewport: { width: 390, height: 844 }, locale: "en-US" });

async function checkParts(page: Page, m: typeof en) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.StudioGuide.title);
  for (const part of GUIDE_PARTS) {
    const heading = page.getByRole("heading", {
      level: 2,
      name: (m.StudioGuide as Record<string, string>)[part.title],
    });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
  }
}

test("the guide from the studio home has each part in English", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.goto("/studio");
  await page.getByRole("link", { name: en.StudioGuide.link }).click();
  await expect(page).toHaveURL(/\/en\/studio-guide$/);
  await checkParts(page, en);
});

test("the guide from the studio home has each part in Dutch", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.goto("/studio");
  await page.getByTestId("language-switcher").getByText("Nederlands", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await page.getByRole("link", { name: nl.StudioGuide.link }).click();
  await expect(page).toHaveURL(/\/nl\/studio-guide$/);
  await checkParts(page, nl);
});
