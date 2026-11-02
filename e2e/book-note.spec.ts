// A dancer adds a note to a booking request on a phone (#387).
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer, type Offer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

let db: Db;
let offer: Offer;

test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");
test.use({ viewport: { width: 390, height: 844 } });

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4387, position: 92 });
});

test("a dancer sends a request with a note", async ({ page }) => {
  await page.goto("/en/book");
  await page.getByRole("link", { name: /€43\.87/ }).click();
  // The last day: today can have no free time left in the evening (#313).
  await page.locator("section", { hasText: en.Book.day }).getByRole("link").last().click();
  await page.locator("section", { hasText: en.Book.time }).getByRole("link").first().click();
  const start = Number(new URL(page.url()).searchParams.get("start"));
  await page.getByLabel(en.Book.name).fill("Ana Note");
  await page.getByLabel(en.Book.email).fill("ana@example.test");
  await page.getByLabel(en.Book.phone).fill("+31 6 1234 5678");
  await page.getByLabel(en.Book.note).fill("  We are two people.  ");
  await expect(page.getByText(en.Book.noteHint)).toBeVisible();
  await page.screenshot({ path: "out/screenshots/book-note-phone.png", fullPage: true });
  await page.getByRole("button", { name: en.Book.send }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
  const rows = db.select().from(bookings).where(eq(bookings.start, start)).all();
  expect(rows).toMatchObject([{ offerId: offer.id, name: "Ana Note", note: "We are two people." }]);
});
