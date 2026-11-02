// Move a requested or approved booking to another free time (#409, epic #406): the checks of a request, its own old
// time, the change to and from summer time, and the calendar sequence.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addBlock } from "../src/db/blocks";
import {
  type BookingInput,
  busyRanges,
  cancelBooking,
  decideBooking,
  moveBooking,
  requestBooking,
} from "../src/db/bookings";
import { addClass, addClassTime } from "../src/db/classes";
import { addOffer, hideOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingEvent } from "../src/lib/booking-ics";

// The default rule: Saturday and Sunday open all day (10:00 to 22:00).
const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();
const NOW = at("2026-10-20T12:00");
const HOUR = 60 * 60_000;

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input = (start: string): BookingInput => ({
    offerId: offer.id,
    start: at(start),
    end: at(start) + HOUR,
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    locale: "nl",
  });
  const book = (start: string, approve = true) => {
    const result = requestBooking(db, input(start), { now: NOW });
    if (!result.ok) throw new Error(`the request at ${start} must be stored`);
    if (approve) decideBooking(db, result.booking.id, "approved", null, NOW);
    return result.booking;
  };
  return { db, offer, book };
}

test("an approved booking moves to a free time: new times, no reminder yet, sequence 1, the new range is busy", () => {
  const { db, book } = setup();
  const booking = book("2026-11-07T14:00");
  db.update(bookings).set({ remindedAt: NOW }).where(eq(bookings.id, booking.id)).run();
  const result = moveBooking(db, booking.id, at("2026-11-08T16:00"), { now: NOW });
  expect(result).toMatchObject({
    ok: true,
    booking: {
      id: booking.id,
      status: "approved",
      start: at("2026-11-08T16:00"),
      end: at("2026-11-08T17:00"),
      remindedAt: null,
      calendarSequence: 1,
    },
    from: { start: at("2026-11-07T14:00"), end: at("2026-11-07T15:00") },
  });
  const week = busyRanges(db, at("2026-11-07T00:00"), at("2026-11-09T00:00"));
  expect(week).toEqual([{ start: at("2026-11-08T16:00"), end: at("2026-11-08T17:00") }]);
});

test("a requested booking moves too, and keeps its status", () => {
  const { db, book } = setup();
  const booking = book("2026-11-07T14:00", false);
  expect(moveBooking(db, booking.id, at("2026-11-07T18:00"), { now: NOW })).toMatchObject({
    ok: true,
    booking: { status: "requested", start: at("2026-11-07T18:00") },
  });
});

test("a move by 30 minutes inside its own old time is allowed", () => {
  const { db, book } = setup();
  const booking = book("2026-11-07T14:00");
  const result = moveBooking(db, booking.id, at("2026-11-07T14:30"), { now: NOW });
  expect(result).toMatchObject({ ok: true, booking: { start: at("2026-11-07T14:30"), end: at("2026-11-07T15:30") } });
});

test("the time of another booking, a block or a class is taken", () => {
  const { db, book } = setup();
  const booking = book("2026-11-07T14:00");
  book("2026-11-07T16:00", false);
  addBlock(db, { start: at("2026-11-07T18:00"), end: at("2026-11-07T19:00") }, NOW);
  const cls = addClass(db, { name: { en: "Salsa" }, text: { en: "Social" }, forWhom: { en: "All" }, position: 0 });
  addClassTime(db, { classId: cls.id, weekday: "sat", from: "20:00", to: "21:30" });
  for (const time of ["2026-11-07T15:30", "2026-11-07T18:30", "2026-11-07T21:00"]) {
    expect(moveBooking(db, booking.id, at(time), { now: NOW }), time).toEqual({ ok: false, reason: "taken" });
  }
  // A refused move changes nothing.
  const row = db.select().from(bookings).where(eq(bookings.id, booking.id)).get();
  expect(row).toMatchObject({ start: at("2026-11-07T14:00"), calendarSequence: 0 });
});

test("a second move to the same time gets taken", () => {
  const { db, book } = setup();
  const first = book("2026-11-07T14:00");
  const second = book("2026-11-07T16:00");
  expect(moveBooking(db, first.id, at("2026-11-08T12:00"), { now: NOW }).ok).toBe(true);
  expect(moveBooking(db, second.id, at("2026-11-08T12:00"), { now: NOW })).toEqual({ ok: false, reason: "taken" });
});

test("a time outside the hours, off the half hour or in the past is not a slot", () => {
  const { db, book } = setup();
  const booking = book("2026-11-07T14:00");
  for (const time of ["2026-11-06T14:00", "2026-11-07T21:30", "2026-11-07T14:10", "2026-10-18T14:00"]) {
    expect(moveBooking(db, booking.id, at(time), { now: NOW }), time).toEqual({ ok: false, reason: "notSlot" });
  }
  expect(moveBooking(db, booking.id, 1.5, { now: NOW })).toEqual({ ok: false, reason: "notSlot" });
});

test("a started booking, a declined or cancelled booking and an unknown id do not move", () => {
  const { db, book } = setup();
  const started = book("2026-11-07T14:00");
  const later = at("2026-11-07T14:30");
  expect(moveBooking(db, started.id, at("2026-11-08T14:00"), { now: later })).toEqual({
    ok: false,
    reason: "started",
  });
  const declined = book("2026-11-07T16:00", false);
  decideBooking(db, declined.id, "declined", null, NOW);
  expect(moveBooking(db, declined.id, at("2026-11-08T14:00"), { now: NOW })).toEqual({
    ok: false,
    reason: "not-open",
  });
  const cancelled = book("2026-11-07T18:00");
  cancelBooking(db, cancelled.id);
  expect(moveBooking(db, cancelled.id, at("2026-11-08T14:00"), { now: NOW })).toEqual({
    ok: false,
    reason: "not-open",
  });
  expect(moveBooking(db, 999, at("2026-11-08T14:00"), { now: NOW })).toEqual({ ok: false, reason: "not-found" });
});

test("a booking of a hidden offer moves with the minutes of its offer", () => {
  const { db } = setup();
  const long = addOffer(db, { kind: "rental", minutes: 120, priceCents: 9000, position: 1 });
  const result = requestBooking(
    db,
    {
      offerId: long.id,
      start: at("2026-11-07T14:00"),
      end: at("2026-11-07T16:00"),
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error("the request must be stored");
  hideOffer(db, long.id);
  expect(moveBooking(db, result.booking.id, at("2026-11-08T10:00"), { now: NOW })).toMatchObject({
    ok: true,
    booking: { offerId: long.id, start: at("2026-11-08T10:00"), end: at("2026-11-08T12:00") },
  });
});

test("a move into the day of the change to summer time and from summer time has the correct UTC start", () => {
  const { db, book } = setup();
  const booking = book("2026-11-07T14:00");
  // Sunday 25 October 2026: the clocks go back from 03:00 to 02:00. 10:00 winter time is 09:00 UTC.
  const fromSummer = moveBooking(db, booking.id, at("2026-10-25T10:00"), { now: NOW });
  expect(fromSummer).toMatchObject({
    ok: true,
    booking: { start: Date.UTC(2026, 9, 25, 9), end: Date.UTC(2026, 9, 25, 10) },
  });
  // Sunday 28 March 2027: the clocks go from 02:00 to 03:00. 10:00 summer time is 08:00 UTC.
  const toSummer = moveBooking(db, booking.id, at("2027-03-28T10:00"), { now: NOW });
  expect(toSummer).toMatchObject({
    ok: true,
    booking: { start: Date.UTC(2027, 2, 28, 8), end: Date.UTC(2027, 2, 28, 9) },
  });
});

test("after two moves the calendar file has SEQUENCE:2 and its cancel file SEQUENCE:3", () => {
  const { db, offer, book } = setup();
  const booking = book("2026-11-07T14:00");
  expect(bookingEvent(booking, offer, "en")).toContain("SEQUENCE:0");
  moveBooking(db, booking.id, at("2026-11-07T16:00"), { now: NOW });
  const result = moveBooking(db, booking.id, at("2026-11-08T16:00"), { now: NOW });
  if (!result.ok) throw new Error("the second move must succeed");
  expect(bookingEvent(result.booking, offer, "en")).toContain("SEQUENCE:2");
  expect(bookingEvent(result.booking, offer, "en")).toContain("DTSTART:20261108T150000Z");
  const cancel = bookingEvent(result.booking, offer, "en", true);
  expect(cancel).toContain("SEQUENCE:3");
  expect(cancel).toContain("STATUS:CANCELLED");
});
