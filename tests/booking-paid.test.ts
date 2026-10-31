// Nina's approved bookings get a paid time, once (#140).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, markPaid, requestBooking } from "../src/db/bookings";
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

test("markPaid sets paidAt of an approved booking once, and a second call keeps the first time", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!result.ok) throw new Error(result.reason);
  const id = result.booking.id;
  db.update(bookings).set({ status: "approved" }).where(eq(bookings.id, id)).run();

  const first = markPaid(db, id, at("2026-11-01T09:00"));
  expect(first).toMatchObject({ ok: true, booking: { id, status: "approved", paidAt: at("2026-11-01T09:00") } });
  expect(markPaid(db, id, at("2026-11-02T09:00"))).toEqual({ ok: false, reason: "already-paid" });
  expect(db.select().from(bookings).where(eq(bookings.id, id)).get()?.paidAt).toBe(at("2026-11-01T09:00"));
});

test("markPaid of a requested, declined or cancelled booking is not-approved and sets nothing", () => {
  const { db, input } = setup();
  const statuses = ["requested", "declined", "cancelled"] as const;
  for (const [i, status] of statuses.entries()) {
    const result = requestBooking(db, input(`2026-11-07T${10 + i * 2}:00`), { now: NOW });
    if (!result.ok) throw new Error(result.reason);
    if (status !== "requested") db.update(bookings).set({ status }).where(eq(bookings.id, result.booking.id)).run();
    expect(markPaid(db, result.booking.id)).toEqual({ ok: false, reason: "not-approved" });
    expect(db.select().from(bookings).where(eq(bookings.id, result.booking.id)).get()?.paidAt).toBeNull();
  }
});

test("markPaid of an unknown booking is not-found", () => {
  const { db } = setup();
  expect(markPaid(db, 999)).toEqual({ ok: false, reason: "not-found" });
});
