import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

test("the home page shows the heading with no console error", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.HomePage.title);
  await expect(page.getByText(en.HomePage.welcome)).toBeVisible();
  expect(errors).toEqual([]);

  await page.screenshot({ path: `out/screenshots/home-${testInfo.project.name}.png`, fullPage: true });
});
