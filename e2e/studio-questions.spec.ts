// The page "For Nina" on a phone (#68): a question of the GitHub stub (`e2e/github-stub.mjs`), and Nina's answer.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test("without a session the questions page goes to the login page", async ({ page }) => {
  await page.goto("/studio/questions");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test.describe("with a session", () => {
  test.use({ storageState: STUDIO_SESSION });

  test("Nina answers a question", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the questions are for the phone");
    await page.goto("/studio");
    await page.getByRole("link", { name: en.StudioHome.questions }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioQuestions.title);

    await expect(page.getByRole("heading", { level: 2 })).toHaveText("the color of the book button");
    await expect(page.getByText("Which color do you like for the book button?")).toBeVisible();
    await expect(page.getByRole("link", { name: en.StudioQuestions.try })).toHaveAttribute("href", "/en/book");
    await page.screenshot({ path: "out/screenshots/studio-questions-phone.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-questions-laptop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByLabel("Light").check();
    await page.getByLabel(en.StudioQuestions.text).fill("A bit warmer, please.");
    await page.getByRole("button", { name: en.StudioQuestions.send }).click();
    await expect(page.getByText(en.StudioQuestions.thanks)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);

    const comments = await (await request.get("http://localhost:3101/__comments")).json();
    expect(comments).toEqual(["Nina's answer: B. Light\n\nA bit warmer, please."]);
  });
});
