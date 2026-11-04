// The home page has no section "Classes" and no section "Every week", and the menu no link to them (Nina, #792).
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };

for (const [locale, messages] of [
  ["en", en],
  ["nl", nl],
] as const) {
  test(`the ${locale} home page has no classes and no schedule`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("section#about")).toBeAttached();
    await expect(page.locator("#classes")).toHaveCount(0);
    await expect(page.locator("#schedule")).toHaveCount(0);
    await expect(page.locator('a[href$="#classes"], a[href$="#schedule"]')).toHaveCount(0);
  });

  test(`the second hero button of the ${locale} home page goes to the prices`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const link = page.getByRole("link", { name: messages.HomePage.secondaryAction });
    await expect(link).toHaveAttribute("href", "#offers");
  });
}
