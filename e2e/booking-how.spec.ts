// The booking form says what happens after the request, above the send button (#819).
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer, hideOffer, type Offer } from "../src/db/offers";

let db: Db;
let offer: Offer;
let longOffer: Offer;

test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");
test.use({ viewport: { width: 390, height: 844 } });

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4391, position: 94 });
  // A day has at most 1440 minutes: this offer has no free time.
  longOffer = addOffer(db, { kind: "lesson", minutes: 1500, priceCents: 4392, position: 95 });
});

test.afterAll(() => {
  hideOffer(db, offer.id);
  hideOffer(db, longOffer.id);
});

for (const [locale, m, price] of [
  ["en", en, /€43\.91/],
  ["nl", nl, /€\s?43,91/],
] as const) {
  test(`the form shows how a booking works (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}/book`);
    await page.getByRole("link", { name: price }).click();
    await page.locator("section", { hasText: m.Book.day }).getByRole("link").last().click();
    await page.locator("section", { hasText: m.Book.time }).getByRole("link").first().click();
    for (const key of ["howAnswer", "howPay", "howMove"] as const) {
      await expect(page.getByText(m.Book[key])).toBeVisible();
    }
    await page.screenshot({ path: `out/screenshots/booking-how-phone-${locale}.png`, fullPage: true });
  });
}

test("the page with no free time does not show how a booking works", async ({ page }) => {
  await page.goto("/en/book");
  await page.getByRole("link", { name: /€43\.92/ }).click();
  await expect(page.getByText(en.Book.noTimes)).toBeVisible();
  await expect(page.getByText(en.Book.howAnswer)).toHaveCount(0);
});
