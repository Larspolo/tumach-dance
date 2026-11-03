// The money of one year for Nina (#627).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { yearMoney, yearRange } from "../src/lib/money";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 0 });
  const add = (
    local: string,
    status: "requested" | "approved" | "declined" | "cancelled",
    price: number,
    paid = false,
  ) =>
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: at(local),
        end: at(local) + 60 * 60_000,
        priceCents: price,
        name: "Ana",
        email: "ana@example.com",
        phone: "+31 6 1234 5678",
        locale: "nl",
        status,
        createdAt: 0,
        paidAt: paid ? at(local) : null,
      })
      .run();
  return { db, add };
}

test("yearRange is 1 January of the year up to 1 January of the next year, Amsterdam time", () => {
  expect(yearRange(2026)).toEqual({ from: at("2026-01-01T00:00"), to: at("2027-01-01T00:00") });
});

test("yearMoney counts 31 December 23:30 in its year and 1 January 00:30 in the next year", () => {
  const { db, add } = setup();
  add("2026-12-31T23:30", "approved", 5000, true);
  add("2027-01-01T00:30", "approved", 4000);
  add("2025-12-31T23:30", "approved", 9900);
  expect(yearMoney(db, 2026)).toEqual({ count: 1, paidCents: 5000, openCents: 0 });
  expect(yearMoney(db, 2027)).toEqual({ count: 1, paidCents: 0, openCents: 4000 });
});

test("yearMoney counts only approved bookings and sums paid and open apart", () => {
  const { db, add } = setup();
  add("2026-02-07T10:00", "approved", 5000, true);
  add("2026-05-08T10:00", "approved", 4000);
  add("2026-08-09T10:00", "approved", 3000);
  add("2026-09-10T10:00", "requested", 9900);
  add("2026-09-11T10:00", "declined", 9900);
  add("2026-09-12T10:00", "cancelled", 9900, true);
  expect(yearMoney(db, 2026)).toEqual({ count: 3, paidCents: 5000, openCents: 7000 });
  expect(db.select().from(bookings).where(eq(bookings.status, "approved")).all()).toHaveLength(3);
});

test("a booking on the last Sunday of March and of October counts once in its year (DST changes)", () => {
  const { db, add } = setup();
  add("2026-03-29T10:00", "approved", 5000); // last Sunday of March 2026: clocks go forward
  add("2026-10-25T10:00", "approved", 6000, true); // last Sunday of October 2026: clocks go back
  expect(yearMoney(db, 2026)).toEqual({ count: 2, paidCents: 6000, openCents: 5000 });
  expect(yearMoney(db, 2025).count).toBe(0);
  expect(yearMoney(db, 2027).count).toBe(0);
});
