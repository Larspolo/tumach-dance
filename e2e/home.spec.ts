import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

const SECTIONS = ["about", "classes", "schedule", "contact"] as const;

test("the home page shows the header and each section with no console error", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.HomePage.title);
  await expect(page.getByText(en.HomePage.welcome)).toBeVisible();
  for (const id of SECTIONS) {
    const section = page.locator(`section#${id}`);
    await expect(section).toBeAttached();
    await expect(section.getByRole("heading", { level: 2 })).toHaveText(en.HomePage[id].title);
  }
  await expect(page.locator("#classes article")).toHaveCount(4);
  await expect(page.getByRole("button", { name: en.HomePage.contact.send })).toBeDisabled();
  expect(errors).toEqual([]);

  await page.screenshot({ path: `out/screenshots/home-${testInfo.project.name}.png`, fullPage: true });
});

test("each nav link goes to its section", async ({ page, isMobile }) => {
  test.skip(isMobile, "a phone shows only the logo, as in the reference");
  await page.goto("/en");
  const nav = page.getByRole("navigation", { name: en.Nav.label });
  for (const id of SECTIONS) {
    await nav.getByRole("link", { name: en.Nav[id] }).click();
    await expect(page).toHaveURL(new RegExp(`/en#${id}$`));
    await expect(page.locator(`section#${id}`)).toBeInViewport();
  }
});
