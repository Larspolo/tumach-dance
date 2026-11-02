// A typo in the email domain on the booking form (#493): the suggestion holds no time; both buttons send.
import { expect, type Page, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

let db: Db;

test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4931, position: 92 });
});

// Each test books its own day: the first day of the list can have one free time, and an earlier test takes it.
async function fillForm(page: Page, day: number) {
  await page.goto("/en/book");
  await page.getByRole("link", { name: /€49\.31/ }).click();
  await page.locator("section", { hasText: en.Book.day }).getByRole("link").nth(day).click();
  await page.locator("section", { hasText: en.Book.time }).getByRole("link").first().click();
  await page.getByLabel(en.Book.name).fill("Typo Test");
  await page.getByLabel(en.Book.email).fill("typo@gmial.com");
  await page.getByLabel(en.Book.phone).fill("+31 6 1234 5678");
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

test("Use the suggestion sends the fixed address", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const start = await fillForm(page, 0);
  await page.screenshot({ path: "out/screenshots/book-email-typo.png", fullPage: true });
  await page.getByRole("button", { name: en.Book.emailUse.replace("{email}", "typo@gmail.com") }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
  expect(sent(start, "typo@gmail.com")).toHaveLength(1);
});

test("My address is right sends it as typed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const start = await fillForm(page, 1);
  await page.getByRole("button", { name: en.Book.emailKeep }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
  expect(sent(start, "typo@gmial.com")).toHaveLength(1);
});
