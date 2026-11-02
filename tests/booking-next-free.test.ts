// The next free day after the 4 weeks of the booking page (#478), also over the change of summer time.
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { nextFreeDate } from "../src/lib/booking-page";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();

function setup(closed: { from: string; to?: string }[]) {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sat: { from: "10:00", to: "13:00" } }, closed });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  return { db, offer };
}

test("the next free day after the 4 weeks, and the day from which the page shows it", () => {
  // The page shows 2026-10-20 to 2026-11-16: all closed. The next Saturday is 2026-11-21, shown from 2026-10-25.
  const { db, offer } = setup([{ from: "2026-10-20", to: "2026-11-16" }]);
  expect(nextFreeDate(db, offer, at("2026-10-20T12:00"))).toEqual({ date: "2026-11-21", from: "2026-10-25" });
});

test("null when none of the 84 days after the 4 weeks has a free time", () => {
  const { db, offer } = setup([{ from: "2026-10-20", to: "2027-02-28" }]);
  expect(nextFreeDate(db, offer, at("2026-10-20T12:00"))).toBeNull();
});

test("the dates are right over the change to summer time (late March)", () => {
  // The page shows 2026-03-20 to 2026-04-16, the summer time starts on 2026-03-29. The next Saturday: 2026-04-18.
  const { db, offer } = setup([{ from: "2026-03-20", to: "2026-04-16" }]);
  expect(nextFreeDate(db, offer, at("2026-03-20T12:00"))).toEqual({ date: "2026-04-18", from: "2026-03-22" });
});

test("the dates are right from summer time (late October)", () => {
  // The page shows 2026-10-24 to 2026-11-20, the summer time ends on 2026-10-25.
  const { db, offer } = setup([{ from: "2026-10-24", to: "2026-11-20" }]);
  expect(nextFreeDate(db, offer, at("2026-10-24T08:00"))).toEqual({ date: "2026-11-21", from: "2026-10-25" });
});
