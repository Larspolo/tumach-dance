// Nina cannot decide a request whose start has passed, and the list leaves it out (#341).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, decideBooking, listOpenRequests, requestBooking } from "../src/db/bookings";
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

test("a request whose start has passed is left out of the open requests", () => {
  const { db, input } = setup();
  const past = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  const future = requestBooking(db, input("2026-11-07T16:00"), { now: NOW });
  if (!past.ok || !future.ok) throw new Error("the requests must be stored");
  const start = at("2026-11-07T14:00");
  expect(listOpenRequests(db, start).map((r) => r.booking.id)).toEqual([future.booking.id]);
  expect(listOpenRequests(db, start - 1).map((r) => r.booking.id)).toEqual([past.booking.id, future.booking.id]);
});

test("decideBooking of a started request gives started and changes nothing", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!result.ok) throw new Error(result.reason);
  const id = result.booking.id;
  expect(decideBooking(db, id, "approved", null, at("2026-11-07T14:00"))).toEqual({ ok: false, reason: "started" });
  expect(db.select().from(bookings).where(eq(bookings.id, id)).get()?.status).toBe("requested");
});

test("a request that starts after now is approved as before", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!result.ok) throw new Error(result.reason);
  expect(decideBooking(db, result.booking.id, "approved", null, at("2026-11-07T13:59"))).toMatchObject({
    ok: true,
    booking: { id: result.booking.id, status: "approved" },
  });
});

test("deciding an unknown booking after its start is still not-found", () => {
  const { db } = setup();
  expect(decideBooking(db, 999, "approved", null, NOW)).toEqual({ ok: false, reason: "not-found" });
});
