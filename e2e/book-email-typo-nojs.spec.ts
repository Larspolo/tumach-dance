// The email typo suggestion of the booking form with no JavaScript (#508): the plain HTML form of the server action
// shows the suggestion, and both buttons send.
import { expect, type Page, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer, listOffers } from "../src/db/offers";
import { bookings } from "../src/db/schema";

let db: Db;

test.use({ javaScriptEnabled: false });
test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  // A failed test starts a new worker that runs this again: add the offer once, so the link finds one offer.
  if (!listOffers(db).some((o) => o.priceCents === 4932)) {
    addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4932, position: 93 });
  }
});

// html has `scroll-behavior: smooth`. A fill scrolls to its field slowly; a click during that scroll starts a new
// scroll, and Playwright waits 30 s for a box that does not move (#508). A tap of a dancer needs no still box.
async function scrollEnds(page: Page) {
  await expect
    .poll(async () => {
      const before = await page.evaluate(() => window.scrollY);
      await page.waitForTimeout(100);
      return (await page.evaluate(() => window.scrollY)) === before;
    })
    .toBe(true);
}

// Each test books its own day: the first day of the list can have one free time, and an earlier test takes it.
async function fillForm(page: Page, day: number) {
  await page.goto("/en/book");
  await page.getByRole("link", { name: /€49\.32/ }).click();
  await page.locator("section", { hasText: en.Book.day }).getByRole("link").nth(day).click();
  await page.locator("section", { hasText: en.Book.time }).getByRole("link").first().click();
  await page.getByLabel(en.Book.name).fill("Typo Test");
  await page.getByLabel(en.Book.email).fill("typo@gmial.com");
  await page.getByLabel(en.Book.phone).fill("+31 6 1234 5678");
  await scrollEnds(page);
  await page.getByRole("button", { name: en.Book.send }).click();
  const start = Number(new URL(page.url()).searchParams.get("start"));
  await expect(page.getByText(en.Book.emailTypo.replace("{email}", "typo@gmail.com"))).toBeVisible();
  expect(db.select().from(bookings).where(eq(bookings.start, start)).all()).toHaveLength(0);
  return start;
}

const sent = (start: number, email: string) =>
  db
    .select()
    .from(bookings)
    .where(and(eq(bookings.start, start), eq(bookings.email, email)))
    .all();

test("With no JavaScript, use the suggestion sends the fixed address", async ({ page }) => {
  const start = await fillForm(page, 0);
  await page.getByRole("button", { name: en.Book.emailUse.replace("{email}", "typo@gmail.com") }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
  expect(sent(start, "typo@gmail.com")).toHaveLength(1);
});

test("With no JavaScript, my address is right sends it as typed", async ({ page }) => {
  const start = await fillForm(page, 1);
  await page.getByRole("button", { name: en.Book.emailKeep }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
  expect(sent(start, "typo@gmial.com")).toHaveLength(1);
});
