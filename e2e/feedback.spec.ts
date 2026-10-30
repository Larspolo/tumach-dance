// The feedback of Nina on a phone and a laptop (#108): the session of `studio.setup.ts`, the GitHub stub of
// `e2e/github-stub.mjs`.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test("without a session the feedback page goes to the login page", async ({ page }) => {
  await page.goto("/studio/feedback");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test.describe("with a session", () => {
  test.use({ storageState: STUDIO_SESSION });

  test("Nina sends feedback and sees the thank-you text", async ({ page }, testInfo) => {
    await page.goto("/studio");
    await page.getByRole("link", { name: en.StudioHome.feedback }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioFeedback.title);
    await page.getByLabel(en.StudioFeedback.label).fill("Please add a class on Friday.");
    await page.getByRole("button", { name: en.StudioFeedback.send }).click();
    await expect(page.getByText(en.StudioFeedback.thanks)).toBeVisible();
    await expect(page.getByLabel(en.StudioFeedback.label)).toHaveValue("");
    await page.screenshot({ path: `out/screenshots/feedback-${testInfo.project.name}.png`, fullPage: true });
  });
});
