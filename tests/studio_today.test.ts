// The approved lessons of today and tomorrow for the studio home (#660, epic #658).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { lessonsOfDays } from "../src/lib/studio-today";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 0 });
  const add = (start: number, end: number, status: "approved" | "requested" | "declined" | "cancelled" = "approved") =>
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start,
        end,
        priceCents: 5000,
        name: "Ana",
        email: "ana@example.com",
        phone: "",
        locale: "nl",
        status,
        createdAt: 0,
        paidAt: null,
        forgottenAt: null,
      })
      .returning({ id: bookings.id })
      .get().id;
  return { db, add };
}

/** Bookings around one local day `day` (YYYY-MM-DD); `now` is noon of that day. Returns the lists by start. */
function scenario(day: string) {
  const { db, add } = setup();
  const next = DateTime.fromISO(day, { zone: "Europe/Amsterdam" }).plus({ days: 1 }).toISODate() as string;
  const after = DateTime.fromISO(day, { zone: "Europe/Amsterdam" }).plus({ days: 2 }).toISODate() as string;
  const yesterday = DateTime.fromISO(day, { zone: "Europe/Amsterdam" }).minus({ days: 1 }).toISODate() as string;
  const hour = 60 * 60_000;

  add(at(`${day}T09:00`), at(`${day}T09:00`) + hour);
  add(at(`${day}T23:30`), at(`${day}T23:30`) + hour);
  add(at(`${next}T00:00`), at(`${next}T00:00`) + hour);

  // Not in either list.
  add(at(`${day}T15:00`), at(`${day}T16:00`), "requested");
  add(at(`${day}T17:00`), at(`${day}T18:00`), "declined");
  add(at(`${day}T19:00`), at(`${day}T20:00`), "cancelled");
  add(at(`${yesterday}T23:00`), at(`${day}T00:30`));
  add(at(`${after}T10:00`), at(`${after}T11:00`));

  const now = at(`${day}T12:00`);
  const result = lessonsOfDays(db, now);
  return {
    today: result.today.map(({ booking }) => booking.start),
    tomorrow: result.tomorrow.map(({ booking }) => booking.start),
  };
}

test("today holds the approved lessons of today, tomorrow holds those of tomorrow, the rest is in neither", () => {
  const { today, tomorrow } = scenario("2026-05-10");
  expect(today).toEqual([at("2026-05-10T09:00"), at("2026-05-10T23:30")]);
  expect(tomorrow).toEqual([at("2026-05-11T00:00")]);
});

test("the 25-hour day of the change to winter time (2026-10-25): a lesson at 23:30 is in today", () => {
  const { today, tomorrow } = scenario("2026-10-25");
  expect(today).toEqual([at("2026-10-25T09:00"), at("2026-10-25T23:30")]);
  expect(tomorrow).toEqual([at("2026-10-26T00:00")]);
});

test("the 23-hour day of the change to summer time (2027-03-28): a lesson at 23:30 is in today", () => {
  const { today, tomorrow } = scenario("2027-03-28");
  expect(today).toEqual([at("2027-03-28T09:00"), at("2027-03-28T23:30")]);
  expect(tomorrow).toEqual([at("2027-03-29T00:00")]);
});

test("a lesson of today that has already ended stays in today", () => {
  const { db, add } = setup();
  const start = at("2026-05-10T08:00");
  add(start, start + 60 * 60_000);
  const now = at("2026-05-10T18:00");
  expect(lessonsOfDays(db, now).today.map(({ booking }) => booking.start)).toEqual([start]);
});
