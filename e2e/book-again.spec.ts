// Book again (#725, epic #722): the link "book another lesson" opens the booking page with the offer of the booking
// selected, and the form has the name, email and phone of the dancer. A wrong or forgotten token gives empty fields.
import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer, hideOffer, type Offer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { againUrl } from "../src/lib/booking-again";

let db: Db;
let offer: Offer;

test.beforeEach(({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the dancer opens the email on a phone");
  return page.setViewportSize({ width: 390, height: 844 });
});

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  // An unusual price finds the offer of this test.
  offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4723, position: 96 });
});

test.afterAll(() => {
  db.delete(bookings).where(eq(bookings.offerId, offer.id)).run();
  hideOffer(db, offer.id);
});

// An earlier booking (in the past: it takes no free time) and the path of its book-again link.
function addBooking(forgotten = false) {
  const start = Date.UTC(2020, 0, 15, 14);
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start,
      end: start + 60 * 60_000,
      name: "Again Dancer",
      email: "again-dancer@example.test",
      phone: "+31 6 7654 3210",
      locale: "en",
      status: "approved",
      createdAt: start,
      forgottenAt: forgotten ? Date.now() : null,
    })
    .returning()
    .get();
  const link = new URL(againUrl("http://localhost:3100", booking));
  return `${link.pathname}${link.search}`;
}

async function chooseTime(page: Page) {
  await page.locator("section", { hasText: en.Book.day }).getByRole("link").last().click();
  await page.locator("section", { hasText: en.Book.time }).getByRole("link").first().click();
  await expect(page.getByLabel(en.Book.name)).toBeVisible();
}

test("the link to book again selects the offer and fills in the form", async ({ page }) => {
  await page.goto(addBooking());
  await expect(page.getByRole("link", { name: /€47\.23/ })).toHaveAttribute("aria-current", "true");
  await chooseTime(page);
  expect(new URL(page.url()).searchParams.get("again")).toBeTruthy();
  await expect(page.getByLabel(en.Book.name)).toHaveValue("Again Dancer");
  await expect(page.getByLabel(en.Book.email)).toHaveValue("again-dancer@example.test");
  await expect(page.getByLabel(en.Book.phone)).toHaveValue("+31 6 7654 3210");
  await page.getByLabel(en.Book.phone).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "out/screenshots/book-again-phone.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/book-again-laptop.png", fullPage: true });
});

for (const [name, path] of [
  ["a wrong token", () => "/en/book?again=nottherighttoken"],
  ["the token of a forgotten booking", () => addBooking(true)],
] as const) {
  test(`${name} opens the normal booking page`, async ({ page }) => {
    await page.goto(path());
    await expect(page.getByRole("link", { name: /€47\.23/ })).not.toHaveAttribute("aria-current", "true");
    await page.getByRole("link", { name: /€47\.23/ }).click();
    await chooseTime(page);
    await expect(page.getByLabel(en.Book.name)).toHaveValue("");
    await expect(page.getByLabel(en.Book.email)).toHaveValue("");
    await expect(page.getByLabel(en.Book.phone)).toHaveValue("");
  });
}
