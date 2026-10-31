// The removal of the personal data of old bookings (#224): the limit of 12 months in Amsterdam time, what stays, a
// second call, and the booking timer.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { cancelLink } from "../src/lib/booking-cancel";
import { forgetOldBookings, KEEP_MONTHS } from "../src/lib/booking-privacy";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

let db: Db;
let offerId: number;

beforeEach(() => {
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock("../src/lib/booking-privacy");
});

/** A booking that ends at `end` (UTC milliseconds). */
function book(end: number, change: Partial<typeof bookings.$inferInsert> = {}) {
  return db
    .insert(bookings)
    .values({
      offerId,
      start: end - HOUR,
      end,
      status: "approved",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: end - 7 * 24 * HOUR,
      paidAt: end - 2 * HOUR,
      ...change,
    })
    .returning()
    .get();
}

const row = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get();

test("the limit is 12 months", () => {
  expect(KEEP_MONTHS).toBe(12);
});

for (const [label, now, limit] of [
  ["a normal day", "2027-06-15T12:00", "2026-06-15T12:00"],
  // The limit falls in the week of the change to summer time (2026-03-29) and back (2026-10-25).
  ["the change to summer time", "2027-03-30T12:00", "2026-03-30T12:00"],
  ["the change to winter time", "2027-10-26T02:30", "2026-10-26T02:30"],
] as const) {
  test(`a booking that ended 12 months and 1 minute ago loses its data, 1 minute less keeps it (${label})`, () => {
    const old = book(at(limit) - MINUTE);
    const recent = book(at(limit) + MINUTE);
    const ids = forgetOldBookings(db, at(now));
    expect(ids).toEqual([old.id]);

    const gone = row(old.id);
    expect(gone).toMatchObject({ name: "", email: "", phone: "", forgottenAt: at(now) });
    expect(gone?.cancelToken).not.toBe(old.cancelToken);
    expect(cancelLink(db, old.cancelToken, at(now)).state).toBe("not-found");
    expect(row(recent.id)).toEqual(recent);
  });
}

test("the offer, the time, the status and the payment stay, for each status; a second call changes nothing", () => {
  const now = at("2027-06-15T12:00");
  const old = (["requested", "approved", "declined", "cancelled"] as const).map((status, i) =>
    book(at("2026-01-10T12:00") + i * HOUR, { status }),
  );
  expect(forgetOldBookings(db, now).sort()).toEqual(old.map((b) => b.id).sort());
  for (const before of old) {
    const after = row(before.id);
    expect(after).toMatchObject({
      offerId: before.offerId,
      start: before.start,
      end: before.end,
      status: before.status,
      paidAt: before.paidAt,
    });
  }
  const tokens = new Set(old.map((b) => row(b.id)?.cancelToken));
  expect(tokens.size).toBe(old.length);

  const snapshot = db.select().from(bookings).all();
  expect(forgetOldBookings(db, now + HOUR)).toEqual([]);
  expect(db.select().from(bookings).all()).toEqual(snapshot);
});

test("the booking timer removes the old data", async () => {
  vi.stubGlobal(
    "setInterval",
    vi.fn(() => ({ unref: vi.fn() })),
  );
  const forget = vi.fn(() => []);
  vi.doMock("../src/lib/booking-privacy", () => ({ forgetOldBookings: forget }));
  delete (globalThis as { tumachBookingTimer?: unknown }).tumachBookingTimer;
  const { startBookingTimer } = await import("../src/lib/booking-timer");
  startBookingTimer(db);
  await vi.waitFor(() => expect(forget).toHaveBeenCalledWith(db));
  delete (globalThis as { tumachBookingTimer?: unknown }).tumachBookingTimer;
});
