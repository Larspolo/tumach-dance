// The boxes of the booking page keep their size when the form shows after a time (#550).
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer, hideOffer } from "../src/db/offers";

test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");

test("the offer and day boxes have the same width before and after the choice of a time", async ({ page }) => {
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4550, position: 92 });
  try {
    await page.goto("/en/book");
    await page.getByRole("link", { name: /€45\.50/ }).click();
    await page.locator("section", { hasText: en.Book.day }).getByRole("link").last().click();
    const widths = () =>
      page.locator("main section a").evaluateAll((els) => els.slice(0, 4).map((e) => e.getBoundingClientRect().width));
    const before = await widths();
    await page.locator("section", { hasText: en.Book.time }).getByRole("link").first().click();
    await expect(page.getByLabel(en.Book.name)).toBeVisible();
    expect(await widths()).toEqual(before);
  } finally {
    hideOffer(db, offer.id);
  }
});
