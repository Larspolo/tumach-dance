// The cancel of a booking in its history (#815): each way to cancel gives one `cancelled` event with its actor, the end
// of an unanswered request gives one `ended` event by the site, and a cancel that does not happen gives no event.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { cancelBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookingEvents, bookings } from "../src/db/schema";
import { cancelByDancer } from "../src/lib/booking-cancel";
import { cancelDay } from "../src/lib/booking-cancel-day";
import { forgetDancerOfBooking } from "../src/lib/booking-forget";
import { checkUnanswered } from "../src/lib/booking-unanswered";
import { cancelOutsideHours } from "../src/lib/bookings-outside-hours";
import { saveHoursRule } from "../src/lib/hours-store";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn(async () => {}) }));

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-11-18T12:00");
const HOUR = 60 * 60_000;
const TOKEN = "a".repeat(40);

let db: Db;
let offerId: number;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function book(start: string, change: Partial<typeof bookings.$inferInsert> = {}) {
  return db
    .insert(bookings)
    .values({
      offerId,
      priceCents: 6000,
      start: at(start),
      end: at(start) + HOUR,
      name: "Ana",
      email: "ana@example.com",
      phone: "",
      locale: "en",
      status: "approved",
      createdAt: NOW - HOUR,
      ...change,
    })
    .returning()
    .get().id;
}

const events = (id: number) =>
  db
    .select({ kind: bookingEvents.kind, by: bookingEvents.by })
    .from(bookingEvents)
    .where(eq(bookingEvents.bookingId, id))
    .all();

test("a cancel by the link gives one cancelled event by the dancer", () => {
  const id = book("2026-11-25T10:00", { cancelToken: TOKEN });
  expect(cancelByDancer(db, TOKEN, NOW)).toMatchObject({ ok: true });
  expect(events(id)).toEqual([{ kind: "cancelled", by: "dancer" }]);
});

test("a cancel by Nina gives one cancelled event by Nina, a second cancel none", () => {
  const id = book("2026-11-25T10:00");
  expect(cancelBooking(db, id, "nina", NOW)).toMatchObject({ ok: true });
  expect(cancelBooking(db, id, "nina", NOW)).toEqual({ ok: false, reason: "not-active" });
  expect(events(id)).toEqual([{ kind: "cancelled", by: "nina" }]);
});

test("the cancel of a day gives one cancelled event by Nina", () => {
  const id = book("2026-11-25T10:00");
  expect(cancelDay(db, "2026-11-25", { now: NOW })).toMatchObject({ ok: true });
  expect(events(id)).toEqual([{ kind: "cancelled", by: "nina" }]);
});

test("the cancel outside the hours gives one cancelled event by Nina", () => {
  const allDay = "allDay" as const;
  saveHoursRule(db, {
    weekly: { mon: allDay, tue: allDay, wed: allDay, thu: allDay, fri: allDay, sat: allDay, sun: allDay },
    closed: [{ from: "2026-11-20" }],
  });
  const id = book("2026-11-20T10:00");
  expect(cancelOutsideHours(db, { now: NOW })).toHaveLength(1);
  expect(events(id)).toEqual([{ kind: "cancelled", by: "nina" }]);
});

test("the removal of the data cancels a coming booking with one event by Nina", async () => {
  const id = book("2026-11-25T10:00");
  await forgetDancerOfBooking(db, id, NOW);
  expect(events(id)).toEqual([{ kind: "cancelled", by: "nina" }]);
});

test("a request with no answer before its start ends with one event by the site", async () => {
  const id = book("2026-11-18T11:30", { status: "requested" });
  expect(await checkUnanswered(db, NOW)).toEqual([id]);
  expect(await checkUnanswered(db, NOW)).toEqual([]);
  expect(events(id)).toEqual([{ kind: "ended", by: "site" }]);
});

test("a cancel that does not happen writes no event", () => {
  const started = book("2026-11-18T11:30", { cancelToken: TOKEN });
  expect(cancelByDancer(db, TOKEN, NOW)).toMatchObject({ ok: false });
  const cancelled = book("2026-11-25T10:00", { status: "cancelled" });
  expect(cancelBooking(db, cancelled, "nina", NOW)).toMatchObject({ ok: false });
  expect(events(started)).toEqual([]);
  expect(events(cancelled)).toEqual([]);
});
