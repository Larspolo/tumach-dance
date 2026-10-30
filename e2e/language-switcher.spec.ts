import { expect, test } from "@playwright/test";

test("a tap on Nederlands opens the Dutch page and the next visit keeps it", async ({ page }, testInfo) => {
  await page.goto("/en");
  const switcher = page.getByTestId("language-switcher");
  await expect(switcher.locator('[aria-current="true"]')).toHaveText("English");
  await page.screenshot({ path: `out/screenshots/language-switcher-${testInfo.project.name}.png` });

  await switcher.getByRole("link", { name: "Nederlands" }).click();
  await expect(page).toHaveURL(/\/nl$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");

  await page.goto("/");
  await expect(page).toHaveURL(/\/nl$/);
});
