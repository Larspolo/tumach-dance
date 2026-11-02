// An unknown address of the studio app (#360): the login with no session, the not-found page of the app with one.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test.use({ viewport: { width: 390, height: 844 } });

test("without a session an unknown studio address goes to the login page", async ({ page }) => {
  await page.goto("/studio/no-such-page");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test.describe("with a session", () => {
  test.use({ storageState: STUDIO_SESSION });

  test("an unknown studio address shows the not-found page with a link to the app", async ({ page }) => {
    const response = await page.goto("/studio/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioNotFound.title);
    await expect(page.getByText(en.StudioNotFound.text)).toBeVisible();
    await page.screenshot({ path: "out/e2e/studio-not-found.png" });
    await page.getByRole("link", { name: en.StudioNotFound.back }).click();
    await expect(page).toHaveURL(/\/studio$/);
  });
});
