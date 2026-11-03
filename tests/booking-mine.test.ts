// The next bookings of a dancer (#743): the token of one booking gives the next requested or approved bookings of the
// same email (any case), by start; a wrong, unknown or forgotten token gives none.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { cancelBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { mineBookings, mineUrl } from "../src/lib/booking-mine";
import { forgetDancer } from "../src/lib/booking-privacy";

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
let n = 0;

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const add = (local: string, email: string, status: "requested" | "approved" = "requested") =>
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: at(local),
        end: at(local) + 3_600_000,
        name: "Ana",
        email,
        phone: "+31 6 1234 5678",
        locale: "en",
        status,
        priceCents: 6000,
        createdAt: NOW,
        cancelToken: `token-${String(++n).padStart(30, "0")}`,
      })
      .returning()
      .get();
  const later = add("2026-11-14T14:00", "Ana@Example.com", "approved");
  const first = add("2026-11-07T14:00", "ana@example.com");
  add("2026-11-08T14:00", "other@example.com");
  add("2026-10-10T14:00", "ana@example.com", "approved");
  const cancelled = add("2026-11-21T14:00", "ana@example.com");
  cancelBooking(db, cancelled.id, "nina");
  return { db, first, later };
}

test("the token gives the next bookings of the same dancer, by start", () => {
  const { db, first, later } = setup();
  const ids = mineBookings(db, first.cancelToken, NOW).map((row) => row.booking.id);
  expect(ids).toEqual([first.id, later.id]);
  expect(mineBookings(db, later.cancelToken, NOW).map((row) => row.booking.id)).toEqual(ids);
});

test("a wrong, an unknown or a forgotten token gives no bookings", () => {
  const { db, first } = setup();
  expect(mineBookings(db, "x", NOW)).toEqual([]);
  expect(mineBookings(db, "u".repeat(40), NOW)).toEqual([]);
  forgetDancer(db, "ana@example.com", NOW);
  expect(db.select().from(bookings).where(eq(bookings.id, first.id)).get()?.forgottenAt).not.toBeNull();
  expect(mineBookings(db, first.cancelToken, NOW)).toEqual([]);
});

test("the address has the locale and the token only", () => {
  expect(mineUrl("https://tumach.dance", { locale: "nl", cancelToken: "abc" })).toBe(
    "https://tumach.dance/nl/booking/mine?token=abc",
  );
});
