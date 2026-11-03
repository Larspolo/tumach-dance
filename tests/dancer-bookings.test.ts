// The other bookings of the dancer of one booking (#622).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { dancerBookings } from "../src/lib/dancer-bookings";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 0 });
  const add = (
    local: string,
    email: string,
    phone: string,
    extra: { status?: "approved" | "requested" | "declined" | "cancelled"; forgottenAt?: number } = {},
  ) =>
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: at(local),
        end: at(local) + 60 * 60_000,
        priceCents: 5000,
        name: "Ana",
        email,
        phone,
        locale: "nl",
        status: extra.status ?? "approved",
        createdAt: 0,
        paidAt: null,
        forgottenAt: extra.forgottenAt ?? null,
      })
      .returning({ id: bookings.id })
      .get().id;
  return { db, add };
}

test("a booking with an email finds the other bookings with the same email in another case", () => {
  const { db, add } = setup();
  const anchor = add("2026-05-01T10:00", "Ana@Example.com", "+31 6 1234 5678");
  add("2026-04-01T10:00", "ana@example.com", "");
  add("2026-06-01T10:00", "ANA@example.COM", "");
  add("2026-07-01T10:00", "other@example.com", "+31 6 1234 5678");
  const found = dancerBookings(db, anchor).map(({ booking }) => booking.start);
  expect(found).toEqual([at("2026-06-01T10:00"), at("2026-04-01T10:00")]);
});

test("a booking with no email finds the bookings with the same phone digits and no email", () => {
  const { db, add } = setup();
  const anchor = add("2026-05-01T10:00", "", "+31 6 1234 5678");
  add("2026-04-01T10:00", "", "+31-6-1234-5678");
  add("2026-06-01T10:00", "other@example.com", "+31 6 1234 5678");
  expect(dancerBookings(db, anchor).map(({ booking }) => booking.start)).toEqual([at("2026-04-01T10:00")]);
});

test("the order is newest first, the booking itself is not in the list, and limit holds", () => {
  const { db, add } = setup();
  const anchor = add("2026-05-01T10:00", "ana@example.com", "");
  for (const day of ["2026-01-01", "2026-02-01", "2026-03-01", "2026-06-01"])
    add(`${day}T10:00`, "ana@example.com", "");
  const all = dancerBookings(db, anchor).map(({ booking }) => booking.start);
  expect(all).toEqual([at("2026-06-01T10:00"), at("2026-03-01T10:00"), at("2026-02-01T10:00"), at("2026-01-01T10:00")]);
  expect(dancerBookings(db, anchor, { limit: 2 })).toHaveLength(2);
  expect(all).not.toContain(at("2026-05-01T10:00"));
});

test("a removed dancer, or a booking with neither email nor phone, gives no bookings", () => {
  const { db, add } = setup();
  add("2026-04-01T10:00", "ana@example.com", "");
  const removed = add("2026-05-01T10:00", "ana@example.com", "", { forgottenAt: at("2026-05-02T10:00") });
  const none = add("2026-05-03T10:00", "", "");
  expect(dancerBookings(db, removed)).toEqual([]);
  expect(dancerBookings(db, none)).toEqual([]);
});
