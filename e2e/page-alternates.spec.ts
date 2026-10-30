// The Dutch book page names its canonical address and the Slovenian page (#239).
import { expect, test } from "@playwright/test";

test("nl/book: canonical to nl/book and hreflang to sl/book", async ({ page }) => {
  await page.goto("/nl/book");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/nl\/book$/);
  await expect(page.locator('link[rel="alternate"][hreflang="sl"]')).toHaveAttribute("href", /\/sl\/book$/);
});
