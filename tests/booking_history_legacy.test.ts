// An older booking (before #814) keeps the events of its row after its first new event (#831).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingHistory, recordBookingEvent } from "../src/lib/booking-history";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-10-20T12:00");

function olderBooking(approvedAt: number | null, paidAt: number | null) {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const row = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      start: at("2026-11-07T14:00"),
      end: at("2026-11-07T15:00"),
      priceCents: 6000,
      status: "approved",
      name: "Ana",
      email: "ana@example.com",
      phone: "",
      locale: "en",
      createdAt: NOW,
      approvedAt,
      paidAt,
    })
    .returning()
    .get();
  return { db, id: row.id };
}

test("an older approved and paid booking with a later cancel gives its row events and the cancel in time order", () => {
  const { db, id } = olderBooking(NOW + 10, NOW + 20);
  recordBookingEvent(db, id, "cancelled", "dancer", { at: NOW + 30 });
  expect(bookingHistory(db, id)).toEqual([
    { at: NOW, kind: "requested", by: "dancer", fromStart: null },
    { at: NOW + 10, kind: "approved", by: "nina", fromStart: null },
    { at: NOW + 20, kind: "paid", by: "site", fromStart: null },
    { at: NOW + 30, kind: "cancelled", by: "dancer", fromStart: null },
  ]);
});

test("an older booking with a later paid event gives one paid event", () => {
  const { db, id } = olderBooking(NOW + 10, NOW + 20);
  recordBookingEvent(db, id, "paid", "site", { at: NOW + 20 });
  expect(bookingHistory(db, id).map((e) => e.kind)).toEqual(["requested", "approved", "paid"]);
});

test("a booking from requestBooking() gives only its stored events", () => {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: at("2026-11-07T14:00"),
      end: at("2026-11-07T15:00"),
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "en",
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(JSON.stringify(result));
  recordBookingEvent(db, result.booking.id, "cancelled", "dancer", { at: NOW + 30 });
  expect(bookingHistory(db, result.booking.id).map((e) => e.kind)).toEqual(["requested", "cancelled"]);
});
