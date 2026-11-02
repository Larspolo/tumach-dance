// The optional note of a dancer to a booking request (#387).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { type BookingInput, busyRanges, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const START = DateTime.fromISO("2026-11-07T14:00", { zone: "Europe/Amsterdam" }).toMillis();

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input = (note: string): BookingInput => ({
    offerId: offer.id,
    start: START,
    end: START + 60 * 60_000,
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    note,
    locale: "en",
  });
  return { db, input };
}

test("a request with a note keeps the trimmed note", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("  We are two people.  "), { now: NOW });
  expect(result).toMatchObject({ ok: true, booking: { note: "We are two people." } });
});

test("an empty note is null", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("   "), { now: NOW });
  expect(result).toMatchObject({ ok: true, booking: { note: null } });
});

test("a note of 501 characters is refused and holds no time", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("a".repeat(501)), { now: NOW });
  expect(result).toEqual({ ok: false, reason: "invalid", field: "note" });
  expect(db.select().from(bookings).all()).toHaveLength(0);
  expect(busyRanges(db, START, START + 60 * 60_000)).toEqual([]);
  expect(requestBooking(db, input("a".repeat(500)), { now: NOW }).ok).toBe(true);
});
