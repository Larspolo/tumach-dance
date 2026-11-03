// Nina repeats a weekly lesson: a closed day and a class time are skipped, and the repeats count on the money page
// (#689, epic #676). The setup is the one of tests/booking_repeat.test.ts.
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addBooking } from "../src/db/bookings";
import { addClass, addClassTime } from "../src/db/classes";
import { addOffer } from "../src/db/offers";
import { repeatBooking } from "../src/lib/booking-repeat";
import { DEFAULT_RULE } from "../src/lib/hours";
import { saveHoursRule } from "../src/lib/hours-store";
import { monthMoney } from "../src/lib/money";

const ZONE = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone: ZONE }).toMillis();
const local = (ms: number) => DateTime.fromMillis(ms, { zone: ZONE }).toFormat("yyyy-MM-dd'T'HH:mm");

function setup(start: string, now: number) {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const result = addBooking(
    db,
    {
      offerId: offer.id,
      start: at(start),
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
    },
    { now },
  );
  if (!result.ok) throw new Error(`no source booking: ${result.reason}`);
  return { db, offer, source: result.booking };
}

test("a repeat of 4 weeks skips a closed day and adds the 3 other weeks", () => {
  const now = at("2026-11-03T12:00");
  const { db, source } = setup("2026-11-07T14:00", now);
  saveHoursRule(db, { ...DEFAULT_RULE, closed: [{ from: "2026-11-21" }] });
  const result = repeatBooking(db, source.id, 4, { now });
  if (!result.ok) throw new Error(result.reason);
  expect(result.skipped).toEqual(["2026-11-21"]);
  expect(result.added.map((b) => local(b.start))).toEqual(["2026-11-14T14:00", "2026-11-28T14:00", "2026-12-05T14:00"]);
});

test("a class time on the weekday of the booking blocks each repeat that overlaps it", () => {
  const now = at("2026-11-03T12:00");
  const { db, source } = setup("2026-11-07T14:00", now);
  const cls = addClass(db, { name: { en: "Salsa" }, text: { en: "Social" }, forWhom: { en: "All" }, position: 0 });
  addClassTime(db, { classId: cls.id, weekday: "sat", from: "13:30", to: "14:30" });
  const result = repeatBooking(db, source.id, 3, { now });
  if (!result.ok) throw new Error(result.reason);
  expect(result.added).toEqual([]);
  expect(result.skipped).toEqual(["2026-11-14", "2026-11-21", "2026-11-28"]);
});

test("the repeats count on the money page of their month: 4 in November, 1 in December", () => {
  const now = at("2026-11-03T12:00");
  const { db, source } = setup("2026-11-07T14:00", now);
  const result = repeatBooking(db, source.id, 4, { now });
  if (!result.ok) throw new Error(result.reason);
  expect(result.skipped).toEqual([]);
  expect(monthMoney(db, "2026-11")).toEqual({ count: 4, paidCents: 0, openCents: 24000 });
  expect(monthMoney(db, "2026-12")).toEqual({ count: 1, paidCents: 0, openCents: 6000 });
});
