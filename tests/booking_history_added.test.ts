// The history of a lesson that Nina adds (#834): one `added` event by nina; a taken time writes no event.

import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookingEvents, bookings } from "../src/db/schema";
import { bookingHistory } from "../src/lib/booking-history";

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input = (start: string) => ({
    offerId: offer.id,
    start: at(start),
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    locale: "nl",
  });
  const events = (id: number) =>
    db
      .select({ kind: bookingEvents.kind, by: bookingEvents.by, at: bookingEvents.at })
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, id))
      .all();
  return { db, input, events };
}

test("addBooking on a free time writes one added event by nina, and the history is only that event", () => {
  const { db, input, events } = setup();
  const result = addBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!result.ok) throw new Error(result.reason);
  expect(events(result.booking.id)).toEqual([{ kind: "added", by: "nina", at: NOW }]);
  expect(bookingHistory(db, result.booking.id)).toEqual([{ kind: "added", by: "nina", at: NOW, fromStart: null }]);
});

test("addBooking on a taken time writes no event", () => {
  const { db, input } = setup();
  const first = addBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!first.ok) throw new Error(first.reason);
  expect(addBooking(db, input("2026-11-07T14:30"), { now: NOW })).toEqual({ ok: false, reason: "taken" });
  // Only the event of the first booking exists.
  expect(db.select().from(bookings).all()).toHaveLength(1);
  expect(db.select().from(bookingEvents).all()).toEqual([
    expect.objectContaining({ bookingId: first.booking.id, kind: "added", by: "nina" }),
  ]);
});
