// The money of one month for Nina (#597).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { monthMoney } from "../src/lib/money";

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

test("monthMoney counts only the approved bookings of the month and sums paid and open apart", () => {
  const { db, add } = setup();
  add("2026-11-07T10:00", "approved", 5000, true);
  add("2026-11-08T10:00", "approved", 4000);
  add("2026-11-09T10:00", "approved", 3000);
  add("2026-11-10T10:00", "requested", 9900);
  add("2026-11-11T10:00", "declined", 9900);
  add("2026-11-12T10:00", "cancelled", 9900, true);
  add("2026-12-01T10:00", "approved", 9900);
  add("2026-10-31T23:30", "approved", 9900);
  expect(monthMoney(db, "2026-11")).toEqual({ count: 3, paidCents: 5000, openCents: 7000 });
  expect(db.select().from(bookings).where(eq(bookings.status, "approved")).all()).toHaveLength(5);
});

test("a booking at 00:30 Amsterdam time on 1 March is in March (winter time, UTC is still February)", () => {
  const { db, add } = setup();
  add("2026-03-01T00:30", "approved", 5000);
  expect(monthMoney(db, "2026-03")).toEqual({ count: 1, paidCents: 0, openCents: 5000 });
  expect(monthMoney(db, "2026-02").count).toBe(0);
});

test("a booking at 00:30 Amsterdam time on 1 October is in October (summer time, UTC is still September)", () => {
  const { db, add } = setup();
  add("2026-10-01T00:30", "approved", 6000, true);
  add("2026-09-30T23:30", "approved", 1000);
  expect(monthMoney(db, "2026-10")).toEqual({ count: 1, paidCents: 6000, openCents: 0 });
  expect(monthMoney(db, "2026-09")).toEqual({ count: 1, paidCents: 0, openCents: 1000 });
});
