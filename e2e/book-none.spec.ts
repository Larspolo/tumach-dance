// The booking page with no free time or no offer links to the contact form on a phone (#477).
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer, hideOffer, type Offer } from "../src/db/offers";

let db: Db;
let longOffer: Offer;

test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");
test.use({ viewport: { width: 390, height: 844 } });

// A day has at most 1440 minutes, so this offer fits in no open time: the page has no free time.
test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  longOffer = addOffer(db, { kind: "lesson", minutes: 1500, priceCents: 4383, position: 93 });
});

test.afterAll(() => {
  hideOffer(db, longOffer.id);
});

test("no free time shows a link to the contact form", async ({ page }) => {
  await page.goto("/en/book");
  await page.getByRole("link", { name: /€43\.83/ }).click();
  const day = page.locator("section", { hasText: en.Book.day });
  await expect(day.getByText(en.Book.noTimes)).toBeVisible();
  await expect(day.getByText(en.Book.contactText)).toBeVisible();
  await day.getByRole("link", { name: en.Book.contact }).click();
  await expect(page).toHaveURL(/\/en#contact$/);
  await expect(page.locator("#contact")).toBeVisible();
});
