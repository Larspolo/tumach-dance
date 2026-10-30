// The booking requests of dancers and the time they hold (#34).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, busyRanges, requestBooking } from "../src/db/bookings";
import { addOffer, hideOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

// The default rule: Saturday and Sunday open all day (10:00 to 22:00).
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

function setup(db: Db = openDb(":memory:")) {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input = (start: string, change: Partial<BookingInput> = {}): BookingInput => ({
    offerId: offer.id,
    start: at(start),
    end: at(start) + 60 * 60_000,
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    locale: "nl",
    ...change,
  });
  return { db, offer, input };
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("a request for a free time is stored with status requested", () => {
  const { db, input } = setup();
  const result = requestBooking(db, input("2026-11-07T14:00", { name: "  Ana  " }), { now: NOW });
  expect(result).toMatchObject({ ok: true, booking: { status: "requested", name: "Ana", locale: "nl" } });
  expect(db.select().from(bookings).all()).toHaveLength(1);
  expect(busyRanges(db, at("2026-11-07T00:00"), at("2026-11-08T00:00"))).toEqual([
    { start: at("2026-11-07T14:00"), end: at("2026-11-07T15:00") },
  ]);
});

test("two requests for the same or an overlapping time at the same moment: one is stored, the other is taken", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tumach-bookings-"));
  dirs.push(dir);
  const path = join(dir, "test.db");
  const { input } = setup(openDb(path));
  for (const [a, b] of [
    ["2026-11-07T14:00", "2026-11-07T14:00"],
    ["2026-11-08T14:00", "2026-11-08T14:30"],
  ]) {
    // Two connections to one file, as two requests of the server.
    const results = await Promise.all([
      (async () => requestBooking(openDb(path), input(a), { now: NOW }))(),
      (async () => requestBooking(openDb(path), input(b, { name: "Bo" }), { now: NOW }))(),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "taken" }]);
  }
  expect(openDb(path).select().from(bookings).all()).toHaveLength(2);
});

test("a declined or cancelled booking does not hold its time", () => {
  const { db, input } = setup();
  for (const status of ["declined", "cancelled"] as const) {
    const first = requestBooking(db, input("2026-11-07T14:00"), { now: NOW });
    if (!first.ok) throw new Error(first.reason);
    expect(requestBooking(db, input("2026-11-07T14:30"), { now: NOW })).toEqual({ ok: false, reason: "taken" });
    db.update(bookings).set({ status }).where(eq(bookings.id, first.booking.id)).run();
    expect(busyRanges(db, at("2026-11-07T00:00"), at("2026-11-08T00:00"))).toEqual([]);
  }
  db.update(bookings).set({ status: "approved" }).where(eq(bookings.id, 1)).run();
  expect(requestBooking(db, input("2026-11-07T14:30"), { now: NOW })).toEqual({ ok: false, reason: "taken" });
  expect(requestBooking(db, input("2026-11-07T15:00"), { now: NOW }).ok).toBe(true);
});

test("a time that is not a free slot of the offer is refused", () => {
  const { db, offer, input } = setup();
  const notSlot = { ok: false, reason: "notSlot" };
  // Outside the open hours: Thursday is closed, Saturday closes at 22:00.
  expect(requestBooking(db, input("2026-11-05T18:00"), { now: NOW })).toEqual(notSlot);
  expect(requestBooking(db, input("2026-11-07T21:30"), { now: NOW })).toEqual(notSlot);
  // A start that is not on a step of 30 minutes, and an end that is not the length of the offer.
  expect(requestBooking(db, input("2026-11-07T14:15"), { now: NOW })).toEqual(notSlot);
  expect(requestBooking(db, input("2026-11-07T14:00", { end: at("2026-11-07T16:00") }), { now: NOW })).toEqual(notSlot);
  // In the past.
  expect(requestBooking(db, input("2026-11-07T14:00"), { now: at("2026-11-07T14:10") })).toEqual(notSlot);
  // A hidden offer.
  hideOffer(db, offer.id);
  expect(requestBooking(db, input("2026-11-07T14:00"), { now: NOW })).toEqual({
    ok: false,
    reason: "invalid",
    field: "offerId",
  });
  expect(db.select().from(bookings).all()).toEqual([]);
});

test("the slots follow the local time at the end of summer time", () => {
  const { db, input } = setup();
  // Sunday 2026-10-25: summer time ends at 03:00. 10:00 local is 09:00 UTC.
  const result = requestBooking(db, input("2026-10-25T10:00"), { now: NOW });
  expect(result.ok && result.booking.start).toBe(Date.UTC(2026, 9, 25, 9));
  expect(requestBooking(db, input("2026-10-25T09:00"), { now: NOW })).toEqual({ ok: false, reason: "notSlot" });
});

test("the server checks the fields of the form", () => {
  const { db, input } = setup();
  const cases: [Partial<BookingInput>, string][] = [
    [{ name: "  " }, "name"],
    [{ email: "ana" }, "email"],
    [{ email: "ana@example" }, "email"],
    [{ phone: "12" }, "phone"],
    [{ phone: "call me" }, "phone"],
    [{ locale: "de" }, "locale"],
    [{ offerId: 999 }, "offerId"],
  ];
  for (const [change, field] of cases) {
    expect(requestBooking(db, input("2026-11-07T14:00", change), { now: NOW })).toEqual({
      ok: false,
      reason: "invalid",
      field,
    });
  }
  expect(db.select().from(bookings).all()).toEqual([]);
});
