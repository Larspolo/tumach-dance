// Nina marks an approved booking paid on the bookings page on a phone, and undoes it (#217, #143).
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("Nina marks an approved booking paid with one tap, and undoes it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the bookings are for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4343, position: 143 });
  // A unique name: the database is shared by the tests. A booking three days ahead, inside the list of the page.
  const name = `Pay Me ${Date.now()}`;
  const start = DateTime.now()
    .setZone(TIME_ZONE)
    .plus({ days: 3 })
    .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      name,
      email: "dancer@example.test",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      createdAt: Date.now(),
    })
    .returning({ id: bookings.id })
    .get();

  await page.goto("/studio/bookings");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioBookings.title);
  const item = page.getByRole("list").last().locator("li", { hasText: name });
  await expect(item).toBeVisible();

  // The date of today in Amsterdam, as the page shows it.
  const today = new Intl.DateTimeFormat("en", { timeZone: TIME_ZONE, day: "numeric", month: "short" }).format(
    new Date(),
  );
  await item.getByRole("button", { name: en.StudioBookings.markPaid, exact: true }).click();
  await expect(item.getByText(en.StudioBookings.paidOn.replace("{date}", today))).toBeVisible();
  expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.paidAt).not.toBeNull();
  await page.screenshot({ path: "out/screenshots/studio-bookings-paid-phone.png", fullPage: true });

  await item.getByRole("button", { name: en.StudioBookings.undo, exact: true }).click();
  await expect(item.getByRole("button", { name: en.StudioBookings.markPaid, exact: true })).toBeVisible();
  expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.paidAt).toBeNull();
});
