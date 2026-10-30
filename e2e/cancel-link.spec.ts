// A dancer cancels a booking with the link of the email on a phone (#164): opening the link changes nothing, the
// button cancels, and the dancer gets the cancel email. A wrong token or a started booking cancels nothing.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { cancelUrl } from "../src/lib/booking-cancel";
import { TIME_ZONE } from "../src/lib/hours";

test.beforeEach(({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the dancer opens the email on a phone");
  return page.setViewportSize({ width: 390, height: 844 });
});

function addBooking(start: DateTime, email: string) {
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 95 });
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      name: "Link Dancer",
      email,
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      createdAt: Date.now(),
    })
    .returning()
    .get();
  // The address of the email, on the test server.
  const link = new URL(cancelUrl("http://localhost:3100", booking));
  return {
    status: () => db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.status,
    path: `${link.pathname}${link.search}`,
  };
}

test("the dancer cancels an approved booking with the link", async ({ page }) => {
  // A Wednesday far in the future: no other test books it.
  const booking = addBooking(DateTime.fromISO("2032-03-17T15:00", { zone: TIME_ZONE }), "link-dancer@example.test");

  await page.goto(booking.path);
  await expect(page.getByRole("heading", { name: en.CancelBooking.title })).toBeVisible();
  await expect(page.getByText("Wednesday, March 17, 2032")).toBeVisible();
  await expect(page.getByText(en.CancelBooking.noRefund)).toBeVisible();
  // Opening the link (GET) changes nothing: a mail scanner opens it too.
  expect(booking.status()).toBe("approved");
  await page.screenshot({ path: "out/screenshots/cancel-link-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/cancel-link-laptop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole("button", { name: en.CancelBooking.button }).click();
  await expect(page.getByText(en.CancelBooking.done)).toBeVisible();
  await expect(page.getByRole("button", { name: en.CancelBooking.button })).toHaveCount(0);
  expect(booking.status()).toBe("cancelled");
  await expect
    .poll(() => readFileSync("out/e2e/email.log", "utf8"))
    .toMatch(/link-dancer@example\.test[\s\S]*You cancelled your booking/);
  await page.screenshot({ path: "out/screenshots/cancel-link-done-phone.png", fullPage: true });

  // The link again: the booking is already cancelled.
  await page.goto(booking.path);
  await expect(page.getByText(en.CancelBooking.cancelled)).toBeVisible();
  await expect(page.getByRole("link", { name: en.CancelBooking.contact })).toBeVisible();
});

test("a wrong token shows how to contact Nina and cancels nothing", async ({ page }) => {
  const booking = addBooking(DateTime.fromISO("2032-03-18T15:00", { zone: TIME_ZONE }), "wrong-token@example.test");
  await page.goto(`${booking.path.slice(0, -2)}xx`);
  await expect(page.getByText(en.CancelBooking.notFound)).toBeVisible();
  await expect(page.getByRole("link", { name: en.CancelBooking.contact })).toHaveAttribute("href", "/en#contact");
  await expect(page.getByRole("button", { name: en.CancelBooking.button })).toHaveCount(0);
  expect(booking.status()).toBe("approved");
});

test("after the start, the link cancels nothing", async ({ page }) => {
  const booking = addBooking(DateTime.now().setZone(TIME_ZONE).minus({ minutes: 10 }), "started@example.test");
  await page.goto(booking.path);
  await expect(page.getByText(en.CancelBooking.started)).toBeVisible();
  await expect(page.getByRole("button", { name: en.CancelBooking.button })).toHaveCount(0);
  expect(booking.status()).toBe("approved");
});
