// The search of the bookings by name, email or phone (#663).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { searchBookings } from "../src/lib/booking-search";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 0 });
  const add = (local: string, name: string, email: string, phone: string, forgottenAt: number | null = null) =>
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: at(local),
        end: at(local) + 60 * 60_000,
        priceCents: 5000,
        name,
        email,
        phone,
        locale: "nl",
        status: "approved",
        createdAt: 0,
        paidAt: null,
        forgottenAt,
      })
      .run();
  return { db, add };
}

const names = (found: { booking: { name: string } }[]) => found.map(({ booking }) => booking.name);

test("a part of the name finds the bookings in any case", () => {
  const { db, add } = setup();
  add("2026-05-01T10:00", "Anna de Vries", "anna@example.com", "");
  add("2026-05-02T10:00", "JOANNA", "joanna@example.com", "");
  add("2026-05-03T10:00", "Kees", "kees@example.com", "");
  expect(names(searchBookings(db, "ann"))).toEqual(["JOANNA", "Anna de Vries"]);
});

test("a part of the email finds the booking", () => {
  const { db, add } = setup();
  add("2026-05-01T10:00", "Kees", "kees.jansen@example.com", "");
  expect(names(searchBookings(db, "jansen@"))).toEqual(["Kees"]);
});

test("the phone matches by its digits, with the trunk 0 or the country code", () => {
  const { db, add } = setup();
  add("2026-05-01T10:00", "Anna", "", "+31 6 1234 5678");
  expect(names(searchBookings(db, "06 1234"))).toEqual(["Anna"]);
  expect(names(searchBookings(db, "+31 6-1234"))).toEqual(["Anna"]);
  expect(names(searchBookings(db, "06-1234 5678"))).toEqual(["Anna"]);
});

test("a query of less than 2 characters finds nothing", () => {
  const { db, add } = setup();
  add("2026-05-01T10:00", "Anna", "a1@example.com", "+31 6 1234 5678");
  expect(searchBookings(db, "1")).toEqual([]);
  expect(searchBookings(db, "a")).toEqual([]);
  expect(searchBookings(db, "  ")).toEqual([]);
});

test("% and _ match only the literal text", () => {
  const { db, add } = setup();
  add("2026-05-01T10:00", "Nina 50% korting", "x@example.com", "");
  add("2026-05-02T10:00", "a_b", "y@example.com", "");
  add("2026-05-03T10:00", "axb", "z@example.com", "");
  expect(names(searchBookings(db, "50%"))).toEqual(["Nina 50% korting"]);
  expect(names(searchBookings(db, "a_b"))).toEqual(["a_b"]);
});

test("a removed dancer is not found", () => {
  const { db, add } = setup();
  add("2026-05-01T10:00", "Anna", "anna@example.com", "", at("2026-05-20T00:00"));
  expect(searchBookings(db, "anna")).toEqual([]);
});

test("the newest first, and at most limit", () => {
  const { db, add } = setup();
  add("2026-05-01T10:00", "Anna 1", "a@example.com", "");
  add("2026-05-03T10:00", "Anna 3", "b@example.com", "");
  add("2026-05-02T10:00", "Anna 2", "c@example.com", "");
  expect(names(searchBookings(db, "anna"))).toEqual(["Anna 3", "Anna 2", "Anna 1"]);
  expect(names(searchBookings(db, "anna", { limit: 2 }))).toEqual(["Anna 3", "Anna 2"]);
});
