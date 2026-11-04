// Nina sees "What happened" under a booking of her week page: the request and her decision (#814).
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { recordBookingEvent } from "../src/lib/booking-history";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("the week page shows what happened to a booking", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the week is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 8140, position: 814 });
  // A Thursday far in the future: no other test books it.
  const start = DateTime.fromISO("2033-03-10T10:00", { zone: TIME_ZONE });
  const requested = DateTime.fromISO("2033-03-01T09:15", { zone: TIME_ZONE }).toMillis();
  const approved = DateTime.fromISO("2033-03-02T18:40", { zone: TIME_ZONE }).toMillis();
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      name: "History Dancer",
      email: "dancer@example.test",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      createdAt: requested,
      approvedAt: approved,
    })
    .returning({ id: bookings.id })
    .get();
  recordBookingEvent(db, booking.id, "requested", "dancer", { at: requested });
  recordBookingEvent(db, booking.id, "approved", "nina", { at: approved });

  await page.goto("/studio/week?start=2033-03-10");
  const item = page.locator(`#booking-${booking.id}`);
  await item.getByText(en.StudioWeek.history).click();
  const events = item.locator("[data-event]");
  await expect(events).toHaveCount(2);
  await expect(events.nth(0)).toContainText("09:15");
  await expect(events.nth(0)).toContainText(en.StudioWeek.event_requested);
  await expect(events.nth(1)).toContainText("18:40");
  await expect(events.nth(1)).toContainText(en.StudioWeek.event_approved);
});
