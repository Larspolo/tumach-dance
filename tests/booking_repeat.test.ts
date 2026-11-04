// Nina repeats the weekly lesson of a regular dancer (#677, epic #676).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addBlock } from "../src/db/blocks";
import { addBooking, cancelBooking, claimDueDecisions, UNDO_MS } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { forgetWhere } from "../src/lib/booking-privacy";
import { REPEAT_WEEKS_MAX, repeatBooking } from "../src/lib/booking-repeat";

// The default rule: Saturday and Sunday open all day (10:00 to 22:00).
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

test("4 free weeks give 4 approved bookings with the same offer, price, contact and local time", () => {
  const now = at("2026-11-03T12:00");
  const { db, offer, source } = setup("2026-11-07T14:00", now);
  const result = repeatBooking(db, source.id, 4, { now });
  if (!result.ok) throw new Error(result.reason);
  expect(result.skipped).toEqual([]);
  expect(result.added.map((b) => local(b.start))).toEqual([
    "2026-11-14T14:00",
    "2026-11-21T14:00",
    "2026-11-28T14:00",
    "2026-12-05T14:00",
  ]);
  for (const booking of result.added) {
    expect(booking).toMatchObject({
      offerId: offer.id,
      priceCents: 6000,
      status: "approved",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      end: booking.start + 60 * 60_000,
    });
  }
  expect(db.select().from(bookings).all()).toHaveLength(5);
});

test("the repeats get no approval email each: the caller sends one email for all the dates", () => {
  const now = at("2026-11-03T12:00");
  const { db, source } = setup("2026-11-07T14:00", now);
  const result = repeatBooking(db, source.id, 3, { now });
  if (!result.ok) throw new Error(result.reason);
  for (const booking of result.added) expect(booking.decisionMailedAt).toBe(now);
  // Only the source booking (added by Nina, with an email) waits for its usual approval email.
  expect(claimDueDecisions(db, now + UNDO_MS).map((b) => b.id)).toEqual([source.id]);
});

test("a week with a block or another booking is skipped and named by its date; the other weeks are added", () => {
  const now = at("2026-11-03T12:00");
  const { db, offer, source } = setup("2026-11-07T14:00", now);
  addBlock(db, { start: at("2026-11-14T13:30"), end: at("2026-11-14T14:30") }, now);
  const other = addBooking(
    db,
    { offerId: offer.id, start: at("2026-11-28T14:00"), name: "Bo", email: "", phone: "+31 6 8765 4321", locale: "en" },
    { now },
  );
  expect(other.ok).toBe(true);
  const result = repeatBooking(db, source.id, 4, { now });
  if (!result.ok) throw new Error(result.reason);
  expect(result.skipped).toEqual(["2026-11-14", "2026-11-28"]);
  expect(result.added.map((b) => local(b.start))).toEqual(["2026-11-21T14:00", "2026-12-05T14:00"]);
});

test("19:00 on 2027-03-21 repeats to 19:00 on 2027-03-28, the first day of summer time", () => {
  const now = at("2027-03-15T12:00");
  const { db, source } = setup("2027-03-21T19:00", now);
  const result = repeatBooking(db, source.id, 2, { now });
  if (!result.ok) throw new Error(result.reason);
  expect(result.added.map((b) => local(b.start))).toEqual(["2027-03-28T19:00", "2027-04-04T19:00"]);
  // One week later is 167 hours later: the night of the change has 23 hours.
  expect(result.added[0].start - source.start).toBe(167 * 3_600_000);
});

test("19:00 on 2026-10-18 repeats to 19:00 on 2026-10-25, the first day of winter time", () => {
  const now = at("2026-10-12T12:00");
  const { db, source } = setup("2026-10-18T19:00", now);
  const result = repeatBooking(db, source.id, 1, { now });
  if (!result.ok) throw new Error(result.reason);
  expect(result.added.map((b) => local(b.start))).toEqual(["2026-10-25T19:00"]);
  expect(result.added[0].start - source.start).toBe(169 * 3_600_000);
});

test("a requested, cancelled or forgotten booking, or a wrong number of weeks, adds nothing", () => {
  const now = at("2026-11-03T12:00");
  const { db, source } = setup("2026-11-07T14:00", now);
  for (const weeks of [0, REPEAT_WEEKS_MAX + 1, 1.5]) {
    expect(repeatBooking(db, source.id, weeks, { now })).toEqual({ ok: false, reason: "weeks" });
  }
  expect(repeatBooking(db, 999, 2, { now })).toEqual({ ok: false, reason: "not-found" });

  db.update(bookings).set({ status: "requested" }).where(eq(bookings.id, source.id)).run();
  expect(repeatBooking(db, source.id, 2, { now })).toEqual({ ok: false, reason: "not-approved" });

  db.update(bookings).set({ status: "approved" }).where(eq(bookings.id, source.id)).run();
  expect(cancelBooking(db, source.id, "nina").ok).toBe(true);
  expect(repeatBooking(db, source.id, 2, { now })).toEqual({ ok: false, reason: "not-approved" });

  db.update(bookings).set({ status: "approved" }).where(eq(bookings.id, source.id)).run();
  forgetWhere(db, eq(bookings.id, source.id), now);
  expect(repeatBooking(db, source.id, 2, { now })).toEqual({ ok: false, reason: "forgotten" });

  expect(db.select().from(bookings).all()).toHaveLength(1);
});
