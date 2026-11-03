import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const [locale, m] of [
    ["en", en],
    ["nl", nl],
  ] as const) {
    test(`the first hero button opens the booking page (${locale})`, async ({ page }, testInfo) => {
      await page.goto(`/${locale}`);
      await page.screenshot({ path: `out/screenshots/home-book-phone-${locale}-${testInfo.project.name}.png` });
      await page.getByRole("link", { name: m.HomePage.primaryAction }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/book$`));
    });
  }
});

test.describe("laptop", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
  for (const [locale, m] of [
    ["en", en],
    ["nl", nl],
  ] as const) {
    test(`the menu link Book opens the booking page (${locale})`, async ({ page }, testInfo) => {
      await page.goto(`/${locale}`);
      await page.screenshot({ path: `out/screenshots/home-book-laptop-${locale}-${testInfo.project.name}.png` });
      const nav = page.getByRole("navigation", { name: m.Nav.label });
      await nav.getByRole("link", { name: m.Nav.book, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/book$`));
    });
  }
});
