// The booking page on a phone (#36): offer, day, time, the form, "request sent"; a taken time; a hidden offer.
import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer, hideOffer, type Offer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

// The database of the test server (`playwright.config.ts`). Unusual prices find the offers of this test.
let db: Db;
let visible: Offer;

test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  visible = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4321, position: 90 });
  const hidden = addOffer(db, { kind: "rental", minutes: 60, priceCents: 4322, position: 91 });
  hideOffer(db, hidden.id);
});

async function chooseTime(page: Page) {
  await page.goto("/en/book");
  await expect(page.getByText("€43.22")).toHaveCount(0);
  await page.getByRole("link", { name: /€43\.21/ }).click();
  // The last day, not today: late in the evening today has one or two free times, and the test of a taken time
  // then shows no time at all (red CI of #316, #317 and #319 at 19:00 local time).
  await page.locator("section", { hasText: en.Book.day }).getByRole("link").last().click();
  const times = page.locator("section", { hasText: en.Book.time }).getByRole("link");
  await times.first().click();
  await expect(page.getByLabel(en.Book.name)).toBeVisible();
  return Number(new URL(page.url()).searchParams.get("start"));
}

test("a dancer requests a free time and sees request sent", async ({ page }) => {
  const start = await chooseTime(page);
  await page.screenshot({ path: "out/screenshots/book-phone.png", fullPage: true });
  await page.getByLabel(en.Book.name).fill("Ana Test");
  await page.getByLabel(en.Book.email).fill("ana@example.test");
  await page.getByLabel(en.Book.phone).fill("+31 6 1234 5678");
  await page.getByRole("button", { name: en.Book.send }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
  const row = db.select().from(bookings).where(eq(bookings.start, start)).all();
  expect(row).toMatchObject([{ status: "requested", name: "Ana Test", offerId: visible.id }]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await chooseTime(page);
  await page.screenshot({ path: "out/screenshots/book-laptop.png", fullPage: true });
});

test("a time that another request took shows the message and the new times", async ({ page }) => {
  const start = await chooseTime(page);
  const other = requestBooking(db, {
    offerId: visible.id,
    start,
    end: start + 60 * 60_000,
    name: "Other",
    email: "other@example.test",
    phone: "+31 6 8765 4321",
    locale: "en",
  });
  expect(other.ok).toBe(true);
  await page.getByLabel(en.Book.name).fill("Ana Test");
  await page.getByLabel(en.Book.email).fill("ana@example.test");
  await page.getByLabel(en.Book.phone).fill("+31 6 1234 5678");
  await page.getByRole("button", { name: en.Book.send }).click();
  await expect(page.getByText(en.Book.taken)).toBeVisible();
  const times = page.locator("section", { hasText: en.Book.time }).getByRole("link");
  await expect(times.first()).toBeVisible();
  const hrefs = await times.evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  expect(hrefs.some((h) => h.includes(`start=${start}`))).toBe(false);
});
