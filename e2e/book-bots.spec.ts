// The bot check of the booking form (#374): a filled honeypot gets "request sent" and makes no booking.
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer, hideOffer, type Offer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

// The database of the test server (`playwright.config.ts`). An unusual price finds the offer of this test.
let db: Db;
let offer: Offer;

test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4374, position: 92 });
});

test.afterAll(() => {
  db.delete(bookings).where(eq(bookings.offerId, offer.id)).run();
  hideOffer(db, offer.id);
});

test("a filled honeypot gets request sent and makes no booking", async ({ page }) => {
  await page.goto("/en/book");
  await page.getByRole("link", { name: /€43\.74/ }).click();
  await page.locator("section", { hasText: en.Book.day }).getByRole("link").last().click();
  await page.locator("section", { hasText: en.Book.time }).getByRole("link").first().click();
  await page.getByLabel(en.Book.name).fill("Bot Test");
  await page.getByLabel(en.Book.email).fill("bot@example.test");
  await page.getByLabel(en.Book.phone).fill("+31 6 1234 5678");
  // A person does not see the field; a bot fills it.
  await page.locator('input[name="website"]').evaluate((input: HTMLInputElement) => {
    input.value = "http://spam.example";
  });
  await page.getByRole("button", { name: en.Book.send }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
  expect(db.select().from(bookings).where(eq(bookings.offerId, offer.id)).all()).toEqual([]);
});
