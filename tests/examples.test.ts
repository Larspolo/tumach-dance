// The example data of a question for Nina (#146): the fixed seeds, at free times only, with no email and no push.
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer, listOffers } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingDays } from "../src/lib/booking-page";
import { openRanges, TIME_ZONE } from "../src/lib/hours";
import { getHoursRule } from "../src/lib/hours-store";

const sendEmail = vi.fn();
const sendPush = vi.fn();
vi.mock("../src/lib/email", () => ({ sendEmail }));
vi.mock("../src/lib/push", () => ({ sendPush }));

const { seedExample } = await import("../src/lib/examples");

// A Tuesday. The default rule opens Friday evening, Saturday and Sunday; Sunday 25 October is the end of summer time.
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: TIME_ZONE }).toMillis();
const WEEK_END = DateTime.fromMillis(NOW, { zone: TIME_ZONE }).startOf("day").plus({ days: 7 }).toMillis();

beforeEach(() => {
  sendEmail.mockReset();
  sendPush.mockReset();
});

test("the bookings seed adds two requests and two approved bookings of the example dancers in the next 7 days", () => {
  const db = openDb(":memory:");
  expect(seedExample(db, "bookings", NOW)).toBe(4);
  const rows = db.select().from(bookings).all();
  expect(rows.map((b) => [b.name, b.email, b.status])).toEqual([
    ["Example 1", "example1@example.com", "requested"],
    ["Example 2", "example2@example.com", "requested"],
    ["Example 3", "example3@example.com", "approved"],
    ["Example 4", "example4@example.com", "approved"],
  ]);
  // With no offer, the seed adds the example offers first and books the first visible one.
  const offer = listOffers(db, { visibleOnly: true })[0];
  expect(rows.every((b) => b.offerId === offer.id)).toBe(true);
  for (const b of rows) {
    expect(b.start).toBeGreaterThanOrEqual(NOW);
    expect(b.end).toBeLessThanOrEqual(WEEK_END);
  }
});

test("the bookings seed takes free times in the open hours only", () => {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  // A dancer has the first free time already.
  const first = bookingDays(db, offer, NOW).find((d) => d.slots.length > 0)?.slots[0];
  if (!first) throw new Error("no free time in the test week");
  const dancer = { name: "Ana", email: "ana@example.com", phone: "+31 6 1234 5678", locale: "nl" };
  expect(requestBooking(db, { offerId: offer.id, ...first, ...dancer }, { now: NOW }).ok).toBe(true);

  expect(seedExample(db, "bookings", NOW)).toBe(4);
  const rows = db.select().from(bookings).all();
  expect(rows).toHaveLength(5);
  const open = openRanges(getHoursRule(db), "2026-10-20", "2026-10-27");
  for (const b of rows) {
    expect(open.some((r) => r.start <= b.start && b.end <= r.end)).toBe(true);
    expect(rows.filter((o) => o.id !== b.id && o.start < b.end && b.start < o.end)).toEqual([]);
  }
  // The seed uses the offer that is there: it adds no offer.
  expect(listOffers(db)).toHaveLength(1);
});

test("the seeds send no email and no push", () => {
  const db = openDb(":memory:");
  seedExample(db, "offers", NOW);
  seedExample(db, "bookings", NOW);
  expect(db.select().from(bookings).all()).toHaveLength(4);
  expect(sendEmail).not.toHaveBeenCalled();
  expect(sendPush).not.toHaveBeenCalled();
});

test("the offers seed adds one lesson and one rental only when there is no offer", () => {
  const db = openDb(":memory:");
  expect(seedExample(db, "offers", NOW)).toBe(2);
  expect(listOffers(db).map((o) => [o.kind, o.visible])).toEqual([
    ["lesson", true],
    ["rental", true],
  ]);
  expect(seedExample(db, "offers", NOW)).toBe(0);
  expect(listOffers(db)).toHaveLength(2);
});
