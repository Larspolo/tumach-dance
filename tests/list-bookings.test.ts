// The bookings of a period with their offer, for the week page and the calendar feed (#101).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { listBookings } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const add = (start: string, status: "requested" | "approved" | "declined" | "cancelled", name = "Ana") => {
    const s = at(start);
    db.insert(bookings)
      .values({
        offerId: offer.id,
        start: s,
        end: s + HOUR,
        status,
        name,
        email: "ana@example.com",
        phone: "+31 6 1234 5678",
        locale: "nl",
        createdAt: NOW,
      })
      .run();
  };
  return { db, add };
}

const ALL = ["requested", "approved", "declined", "cancelled"] as const;
const from = at("2026-11-07T00:00");
const to = at("2026-11-08T00:00");

test("lists the bookings inside the period and the ones that overlap its start or its end", () => {
  const { db, add } = setup();
  add("2026-11-07T14:00", "approved", "inside");
  add("2026-11-06T23:30", "requested", "over the start");
  add("2026-11-07T23:30", "requested", "over the end");
  add("2026-11-06T22:00", "approved", "before");
  add("2026-11-08T00:00", "approved", "after");
  const names = listBookings(db, from, to, ALL).map((r) => r.booking.name);
  expect(names).toEqual(["over the start", "inside", "over the end"]);
});

test("a booking that ends exactly at the start of the period is not listed", () => {
  const { db, add } = setup();
  add("2026-11-06T23:00", "approved", "ends at the start");
  expect(listBookings(db, from, to, ALL)).toEqual([]);
});

test("only the given statuses are listed", () => {
  const { db, add } = setup();
  add("2026-11-07T10:00", "requested", "requested");
  add("2026-11-07T11:00", "approved", "approved");
  add("2026-11-07T12:00", "declined", "declined");
  add("2026-11-07T13:00", "cancelled", "cancelled");
  expect(listBookings(db, from, to, ["approved"]).map((r) => r.booking.name)).toEqual(["approved"]);
  expect(listBookings(db, from, to, ["requested", "declined"]).map((r) => r.booking.name)).toEqual([
    "requested",
    "declined",
  ]);
  expect(listBookings(db, from, to, [])).toEqual([]);
});

test("each booking comes with its offer, ordered by start", () => {
  const { db, add } = setup();
  add("2026-11-07T15:00", "approved", "late");
  add("2026-11-07T09:00", "approved", "early");
  const rows = listBookings(db, from, to, ALL);
  expect(rows.map((r) => r.booking.name)).toEqual(["early", "late"]);
  expect(rows[0].offer).toMatchObject({ kind: "lesson", minutes: 60, priceCents: 6000 });
});
