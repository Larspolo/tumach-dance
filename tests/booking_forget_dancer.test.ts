// The removal of the personal data of one dancer from all their bookings (#361, epic #358): by email in any case,
// past and coming, the offer, time, status and payment stay, a second call and an empty email change nothing.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { cancelLink } from "../src/lib/booking-cancel";
import { forgetDancer } from "../src/lib/booking-privacy";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;

let db: Db;
let offerId: number;

beforeEach(() => {
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

/** A booking that ends at `end` (UTC milliseconds). */
function book(end: number, change: Partial<typeof bookings.$inferInsert> = {}) {
  return db
    .insert(bookings)
    .values({
      offerId,
      start: end - HOUR,
      end,
      status: "approved",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: end - 7 * 24 * HOUR,
      paidAt: end - 2 * HOUR,
      ...change,
    })
    .returning()
    .get();
}

const row = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get();

test("forgetDancer clears the data of each booking of the email in any case, past and coming, and gives their ids", () => {
  const now = at("2027-06-15T12:00");
  const past = book(at("2026-01-10T12:00"), { status: "cancelled" });
  const coming = book(at("2027-07-01T12:00"), { status: "requested", paidAt: null });
  const upper = book(at("2027-08-01T12:00"), { email: "ANA@Example.com" });

  const ids = forgetDancer(db, "Ana@Example.com", now);
  expect(ids.sort()).toEqual([past.id, coming.id, upper.id].sort());

  for (const before of [past, coming, upper]) {
    const after = row(before.id);
    expect(after).toMatchObject({ name: "", email: "", phone: "", forgottenAt: now });
    expect(after?.cancelToken).not.toBe(before.cancelToken);
    expect(cancelLink(db, before.cancelToken, now).state).toBe("not-found");
  }
});

test("forgetDancer keeps the offer, time, status and payment, and does not change the bookings of another email", () => {
  const now = at("2027-06-15T12:00");
  const mine = (["requested", "approved", "declined", "cancelled"] as const).map((status, i) =>
    book(at("2027-07-01T12:00") + i * HOUR, { status }),
  );
  const other = book(at("2027-07-01T12:00"), { name: "Bo", email: "bo@example.com", phone: "+31 6 0000 0000" });

  forgetDancer(db, "ana@example.com", now);

  for (const before of mine) {
    expect(row(before.id)).toMatchObject({
      offerId: before.offerId,
      start: before.start,
      end: before.end,
      status: before.status,
      paidAt: before.paidAt,
    });
  }
  expect(row(other.id)).toEqual(other);
});

test("a second call returns [], and an empty email returns [] and changes nothing", () => {
  const now = at("2027-06-15T12:00");
  book(at("2027-07-01T12:00"));
  book(at("2027-07-02T12:00"), { email: "" });
  expect(forgetDancer(db, "ana@example.com", now)).toHaveLength(1);

  const snapshot = db.select().from(bookings).all();
  expect(forgetDancer(db, "ana@example.com", now + HOUR)).toEqual([]);
  expect(forgetDancer(db, " ", now + HOUR)).toEqual([]);
  expect(db.select().from(bookings).all()).toEqual(snapshot);
});
