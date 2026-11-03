// The removal of the data of a dancer with no email by the phone digits (#620, epic #616).
import { eq } from "drizzle-orm";
import { beforeEach, expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { forgetDancerOfBooking } from "../src/lib/booking-forget";
import { phoneDigits } from "../src/lib/same-dancer";

const NOW = Date.UTC(2027, 2, 1, 12);
const HOUR = 60 * 60_000;
let db: Db;
let offerId: number;

beforeEach(() => {
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function add(start: number, email: string, phone: string, status: "requested" | "approved" = "approved") {
  return db
    .insert(bookings)
    .values({
      offerId,
      priceCents: 6000,
      start,
      end: start + HOUR,
      name: "Ana",
      email,
      phone,
      locale: "en",
      status,
      createdAt: NOW - 100 * HOUR,
    })
    .returning()
    .get();
}
const row = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get();

test("phoneDigits keeps only the digits", () => {
  expect(phoneDigits("+31 (6) 1234-5678")).toBe("31612345678");
});

test("a booking with no email removes the bookings with the same phone digits and cancels the coming ones", async () => {
  const past = add(NOW - 48 * HOUR, "", "+31 6 1234 5678");
  const coming = add(NOW + 48 * HOUR, "", "+31-6-12345678", "requested");
  const other = add(NOW + 72 * HOUR, "", "+31 6 9999 0000");
  const withEmail = add(NOW + 96 * HOUR, "bo@example.com", "+31 6 1234 5678");

  const ids = await forgetDancerOfBooking(db, past.id, NOW);
  expect(ids.sort()).toEqual([past.id, coming.id].sort());
  expect(row(coming.id)).toMatchObject({ status: "cancelled", name: "", phone: "", forgottenAt: NOW });
  expect(row(past.id)).toMatchObject({ status: "approved", name: "", phone: "" });
  expect(row(other.id)).toMatchObject({ status: "approved", name: "Ana" });
  expect(row(withEmail.id)).toMatchObject({ status: "approved", name: "Ana", email: "bo@example.com" });
});

test("a booking with neither email nor phone clears only its own data", async () => {
  const own = add(NOW + 48 * HOUR, "", "");
  const twin = add(NOW + 72 * HOUR, "", "");
  expect(await forgetDancerOfBooking(db, own.id, NOW)).toEqual([own.id]);
  expect(row(own.id)).toMatchObject({ status: "cancelled", name: "" });
  expect(row(twin.id)).toMatchObject({ status: "approved", name: "Ana" });
});
