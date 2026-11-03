// The coming bookings outside the open hours of a rule (#712, epic #711).
// Bookings are made under the default hours (addBooking refuses a slot outside them); the rule under test is passed to
// bookingsOutsideHours(), as after Nina changes her hours.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addBooking, cancelBooking, decideBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingsOutsideHours } from "../src/lib/bookings-outside-hours";
import { DEFAULT_RULE, type HoursRule } from "../src/lib/hours";

const ZONE = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone: ZONE }).toMillis();
const NOW = at("2026-11-03T12:00");

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const add = (local: string, now = NOW) => {
    const r = addBooking(
      db,
      { offerId: offer.id, start: at(local), name: "Ana", email: "a@example.com", phone: "", locale: "nl" },
      { now },
    );
    if (!r.ok) throw new Error(`${local}: ${r.reason}`);
    return r.booking;
  };
  return { db, add };
}

type Db = ReturnType<typeof setup>["db"];

/** The starts (local, "YYYY-MM-DDTHH:mm") of the bookings outside the rule. */
function outside(db: Db, rule: HoursRule, now = NOW): string[] {
  return bookingsOutsideHours(db, rule, { now }).map((b) =>
    DateTime.fromMillis(b.start, { zone: ZONE }).toFormat("yyyy-MM-dd'T'HH:mm"),
  );
}

test("a booking inside the open hours is not listed", () => {
  const { db, add } = setup();
  add("2026-11-07T18:00"); // a Saturday, all day
  expect(outside(db, DEFAULT_RULE)).toEqual([]);
});

test("a booking that ends after the new closing time is listed", () => {
  const { db, add } = setup();
  add("2026-11-07T21:00"); // ends 22:00, the default closing time
  const earlier: HoursRule = {
    ...DEFAULT_RULE,
    weekly: { ...DEFAULT_RULE.weekly, sat: { from: "10:00", to: "21:30" } },
  };
  expect(outside(db, earlier)).toEqual(["2026-11-07T21:00"]);
});

test("cancelled, declined, ended and forgotten bookings are not listed", () => {
  const { db, add } = setup();
  const saturdayClosed: HoursRule = { ...DEFAULT_RULE, weekly: { ...DEFAULT_RULE.weekly, sat: "closed" } };
  const cancelled = add("2026-11-07T18:00");
  cancelBooking(db, cancelled.id);
  const declined = add("2026-11-14T18:00");
  db.update(bookings).set({ status: "requested" }).where(eq(bookings.id, declined.id)).run();
  decideBooking(db, declined.id, "declined", null, NOW);
  const forgotten = add("2026-11-21T18:00");
  db.update(bookings).set({ forgottenAt: NOW }).where(eq(bookings.id, forgotten.id)).run();
  const ended = add("2026-11-28T18:00");
  db.update(bookings)
    .set({ start: at("2026-11-02T18:00"), end: at("2026-11-02T19:00") })
    .where(eq(bookings.id, ended.id))
    .run();
  const requested = add("2026-12-05T18:00");
  db.update(bookings).set({ status: "requested" }).where(eq(bookings.id, requested.id)).run();
  // Only the requested booking that is still coming is listed.
  expect(outside(db, saturdayClosed)).toEqual(["2026-12-05T18:00"]);
});

test("a closed period that holds a booking lists it", () => {
  const { db, add } = setup();
  add("2026-11-07T18:00");
  const rule: HoursRule = { ...DEFAULT_RULE, closed: [{ from: "2026-11-07", to: "2026-11-08" }] };
  expect(outside(db, rule)).toEqual(["2026-11-07T18:00"]);
});

test("new weekly hours that leave a booking out list it", () => {
  const { db, add } = setup();
  add("2026-11-09T18:00"); // a Monday, open from 17:00
  expect(outside(db, DEFAULT_RULE)).toEqual([]);
  const noMonday: HoursRule = { ...DEFAULT_RULE, weekly: { ...DEFAULT_RULE.weekly, mon: "closed" } };
  expect(outside(db, noMonday)).toEqual(["2026-11-09T18:00"]);
});

test("the days of a change of summer time: a booking inside the hours is not listed", () => {
  const { db, add } = setup();
  const before = at("2026-10-01T00:00");
  add("2026-10-25T15:00", before); // the clocks go back that day
  add("2027-03-28T15:00", before); // the clocks go forward that day
  expect(outside(db, DEFAULT_RULE, before)).toEqual([]);
});
