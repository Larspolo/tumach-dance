// The news note of the home page in the studio app (#654): save with an end date, change, remove; the errors of a
// note that is too long and of a past date; no serious axe barrier.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

const day = (days: number) => DateTime.now().setZone("Europe/Amsterdam").plus({ days }).toISODate() ?? "";

test("without a session the news page goes to the login page", async ({ page }) => {
  await page.goto("/studio/news");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test.describe("with a session", () => {
  test.use({ storageState: STUDIO_SESSION });

  test("Nina saves, changes and removes the note", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
    await page.goto("/studio/news");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioNews.title);

    await page.getByLabel(en.StudioNews.text).fill("Closed for a holiday."); // tap 2 and type
    await page.getByLabel(en.StudioNews.endDate).fill(day(7));
    await page.getByRole("button", { name: en.StudioNews.save }).click(); // tap 3
    await expect(page.getByText(en.StudioNews.saved)).toBeVisible();
    await expect(page.locator("blockquote")).toHaveText("Closed for a holiday.");
    await expect(page.getByText(/^Shows until /)).toBeVisible();

    await page.screenshot({ path: "out/screenshots/studio-news-phone.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-news-laptop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    await page.getByLabel(en.StudioNews.text).fill("A new class on Friday.");
    await page.getByLabel(en.StudioNews.endDate).fill("");
    await page.getByRole("button", { name: en.StudioNews.save }).click();
    await expect(page.locator("blockquote")).toHaveText("A new class on Friday.");
    await expect(page.getByText(en.StudioNews.noEnd)).toBeVisible();

    await page.getByRole("button", { name: en.StudioNews.remove }).click();
    await expect(page.getByText(en.StudioNews.removed)).toBeVisible();
    await expect(page.getByText(en.StudioNews.none)).toBeVisible();
  });

  test("a note that is too long or a past date shows its error", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
    await page.goto("/studio/news");
    // The browser keeps the limits; take them away to see the check of the server.
    await page.locator("form", { has: page.locator("textarea") }).evaluate((f) => f.setAttribute("novalidate", ""));
    await page.locator("textarea").evaluate((e) => e.removeAttribute("maxlength"));
    await page.getByLabel(en.StudioNews.text).fill("x".repeat(281));
    await page.getByRole("button", { name: en.StudioNews.save }).click();
    await expect(page.getByText(en.StudioNews.error.long)).toBeVisible();

    await page.locator("form", { has: page.locator("textarea") }).evaluate((f) => f.setAttribute("novalidate", ""));
    await page.getByLabel(en.StudioNews.text).fill("Hello");
    await page.getByLabel(en.StudioNews.endDate).fill(day(-2));
    await page.getByRole("button", { name: en.StudioNews.save }).click();
    await expect(page.getByText(en.StudioNews.error.date)).toBeVisible();
  });
});
