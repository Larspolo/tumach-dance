// The guide of the studio app is one tap from the studio home, in the language of the studio app (#775, epic #774).
import { expect, type Page, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION, viewport: { width: 390, height: 844 }, locale: "en-US" });

function choose(page: Page, name: string) {
  return page.getByTestId("language-switcher").getByText(name, { exact: true }).click();
}

test("one tap on the studio home opens the guide in English", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.goto("/studio");
  await page.getByRole("link", { name: en.StudioGuide.link }).click(); // tap 1
  await expect(page).toHaveURL(/\/en\/studio-guide$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioGuide.title);
});

test("with the studio language Dutch the guide link opens the Dutch guide", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.goto("/studio");
  await choose(page, "Nederlands");
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await page.getByRole("link", { name: nl.StudioGuide.link }).click();
  await expect(page).toHaveURL(/\/nl\/studio-guide$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nl.StudioGuide.title);
});
