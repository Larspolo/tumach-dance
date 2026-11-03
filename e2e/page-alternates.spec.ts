// The Dutch book page names its canonical address and the English page (#239); Slovenian is gone (#299).
import { expect, test } from "@playwright/test";

test("nl/book: canonical to nl/book and hreflang to en/book, none to sl", async ({ page }) => {
  await page.goto("/nl/book");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/nl\/book$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/book$/);
  await expect(page.locator('link[rel="alternate"][hreflang="sl"]')).toHaveCount(0);
});

test("/sl and /sl/book go to the English page (#299)", async ({ page }) => {
  await page.goto("/sl");
  await expect(page).toHaveURL(/\/en$/);
  await page.goto("/sl/book");
  await expect(page).toHaveURL(/\/en\/book$/);
  await expect(page.getByTestId("language-switcher").getByRole("link")).toHaveCount(2);
});
