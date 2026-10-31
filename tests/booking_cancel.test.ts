// Nina or the dancer cancels a requested or approved booking (#159): the status, the freed time, and the repeat call.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, busyRanges, cancelBooking, decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

// The default rule: Saturday and Sunday open all day (10:00 to 22:00).
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

function setup(db: Db = openDb(":memory:")) {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input = (start: string, change: Partial<BookingInput> = {}): BookingInput => ({
    offerId: offer.id,
    start: at(start),
    end: at(start) + 60 * 60_000,
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    locale: "nl",
    ...change,
  });
  return { db, offer, input };
}

test("a requested booking is cancelled and frees its time", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!result.ok) throw new Error("the request must be stored");
  const { id } = result.booking;
  expect(busyRanges(db, at("2026-11-07T00:00"), at("2026-11-08T00:00"))).toHaveLength(1);
  expect(cancelBooking(db, id)).toMatchObject({ ok: true, booking: { id, status: "cancelled" } });
  expect(busyRanges(db, at("2026-11-07T00:00"), at("2026-11-08T00:00"))).toHaveLength(0);
});

test("an approved booking is cancelled and keeps paidAt when it was paid", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!result.ok) throw new Error("the request must be stored");
  decideBooking(db, result.booking.id, "approved");
  db.update(bookings).set({ paidAt: 123 }).where(eq(bookings.id, result.booking.id)).run();
  expect(cancelBooking(db, result.booking.id)).toMatchObject({
    ok: true,
    booking: { status: "cancelled", paidAt: 123 },
  });
});

test("a second call and a declined booking are not active; an unknown id is not found", () => {
  const { db, input } = setup();
  const requested = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  const declined = requestBooking(db, input("2026-11-07T16:00"), { now: NOW });
  if (!requested.ok || !declined.ok) throw new Error("the requests must be stored");
  cancelBooking(db, requested.booking.id);
  expect(cancelBooking(db, requested.booking.id)).toEqual({ ok: false, reason: "not-active" });
  decideBooking(db, declined.booking.id, "declined");
  expect(cancelBooking(db, declined.booking.id)).toEqual({ ok: false, reason: "not-active" });
  expect(db.select().from(bookings).where(eq(bookings.id, declined.booking.id)).get()?.status).toBe("declined");
  expect(cancelBooking(db, 999)).toEqual({ ok: false, reason: "not-found" });
});
