// Nina approves or declines a booking request, and the open requests she sees (#74).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, busyRanges, decideBooking, listOpenRequests, requestBooking } from "../src/db/bookings";
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

test("Nina approves or declines a requested booking", () => {
  const { db, input } = setup();
  const approved = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  const declined = requestBooking(db, input("2026-11-07T16:00"), { now: NOW });
  if (!approved.ok || !declined.ok) throw new Error("the requests must be stored");
  expect(decideBooking(db, approved.booking.id, "approved")).toMatchObject({
    ok: true,
    booking: { id: approved.booking.id, status: "approved" },
  });
  expect(decideBooking(db, declined.booking.id, "declined")).toMatchObject({
    ok: true,
    booking: { id: declined.booking.id, status: "declined" },
  });
});

test("a second decision on the same booking is not-requested and changes nothing", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!result.ok) throw new Error(result.reason);
  const id = result.booking.id;
  expect(decideBooking(db, id, "approved").ok).toBe(true);
  expect(decideBooking(db, id, "declined")).toEqual({ ok: false, reason: "not-requested" });
  expect(db.select().from(bookings).where(eq(bookings.id, id)).get()?.status).toBe("approved");
});

test("deciding an unknown booking is not-found", () => {
  const { db } = setup();
  expect(decideBooking(db, 999, "approved")).toEqual({ ok: false, reason: "not-found" });
});

test("after a decline the time is free, and a new request for it is ok", () => {
  const { db, input } = setup();
  const first = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!first.ok) throw new Error(first.reason);
  expect(requestBooking(db, input("2026-11-07T14:00"), { now: NOW })).toEqual({ ok: false, reason: "taken" });
  expect(decideBooking(db, first.booking.id, "declined").ok).toBe(true);
  expect(busyRanges(db, at("2026-11-07T00:00"), at("2026-11-08T00:00"))).toEqual([]);
  expect(requestBooking(db, input("2026-11-07T14:00"), { now: NOW }).ok).toBe(true);
});

test("listOpenRequests gives only the requested bookings, with their offer, by start", () => {
  const { db, offer, input } = setup();
  const late = requestBooking(db, input("2026-11-07T18:00"), { now: NOW });
  const early = requestBooking(db, input("2026-11-07T11:00"), { now: NOW });
  const done = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!late.ok || !early.ok || !done.ok) throw new Error("the requests must be stored");
  decideBooking(db, done.booking.id, "approved");
  const open = listOpenRequests(db);
  expect(open.map((row) => row.booking.id)).toEqual([early.booking.id, late.booking.id]);
  expect(open[0]).toMatchObject({ offer: { id: offer.id, kind: "lesson" } });
});
