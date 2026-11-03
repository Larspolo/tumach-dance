// Nina adds a lesson that she agreed by WhatsApp or phone as an approved booking (#617).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addBlock } from "../src/db/blocks";
import { type AddBookingInput, addBooking, claimDueDecisions, markPaid, UNDO_MS } from "../src/db/bookings";
import { addClass, addClassTime } from "../src/db/classes";
import { addOffer, hideOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { monthMoney } from "../src/lib/money";

// The default rule: Saturday and Sunday open all day (10:00 to 22:00).
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input = (start: string, change: Partial<AddBookingInput> = {}): AddBookingInput => ({
    offerId: offer.id,
    start: at(start),
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    locale: "nl",
    ...change,
  });
  return { db, offer, input };
}

test("addBooking stores an approved booking with the price of its offer, also for a hidden offer", () => {
  const { db, offer, input } = setup();
  const result = addBooking(db, input("2026-11-07T14:00"), { now: NOW });
  expect(result).toMatchObject({
    ok: true,
    booking: {
      status: "approved",
      priceCents: 6000,
      start: at("2026-11-07T14:00"),
      end: at("2026-11-07T15:00"),
      createdAt: NOW,
      approvedAt: NOW,
      decidedAt: NOW,
      decisionMailedAt: null,
      locale: "nl",
    },
  });
  hideOffer(db, offer.id);
  expect(addBooking(db, input("2026-11-07T16:00"), { now: NOW })).toMatchObject({ ok: true });
  expect(addBooking(db, input("2026-11-07T18:00", { offerId: 999 }), { now: NOW })).toEqual({
    ok: false,
    reason: "invalid",
    field: "offerId",
  });
});

test("a time that is not free gives notSlot or taken and stores nothing", () => {
  const { db, input } = setup();
  addBooking(db, input("2026-11-07T14:00"), { now: NOW });
  addBlock(db, { start: at("2026-11-07T18:00"), end: at("2026-11-07T19:00") }, NOW);
  const cls = addClass(db, { name: { en: "Salsa" }, text: { en: "Social" }, forWhom: { en: "All" }, position: 0 });
  addClassTime(db, { classId: cls.id, weekday: "sat", from: "20:00", to: "21:30" });
  for (const time of ["2026-11-07T14:30", "2026-11-07T18:00", "2026-11-07T20:30"]) {
    expect(addBooking(db, input(time), { now: NOW }), time).toEqual({ ok: false, reason: "taken" });
  }
  // Out of the hours (a Tuesday, closed) and in the past.
  for (const time of ["2026-11-03T14:00", "2026-10-18T14:00"]) {
    expect(addBooking(db, input(time), { now: NOW }), time).toEqual({ ok: false, reason: "notSlot" });
  }
  expect(db.select().from(bookings).all()).toHaveLength(1);
});

test("the name is required; an empty email and phone are accepted, a wrong one is invalid", () => {
  const { db, input } = setup();
  expect(addBooking(db, input("2026-11-07T14:00", { name: " " }), { now: NOW })).toEqual({
    ok: false,
    reason: "invalid",
    field: "name",
  });
  expect(addBooking(db, input("2026-11-07T14:00", { email: "ana" }), { now: NOW })).toEqual({
    ok: false,
    reason: "invalid",
    field: "email",
  });
  expect(addBooking(db, input("2026-11-07T14:00", { phone: "abc" }), { now: NOW })).toEqual({
    ok: false,
    reason: "invalid",
    field: "phone",
  });
  expect(addBooking(db, input("2026-11-07T14:00", { locale: "fr" }), { now: NOW })).toMatchObject({ field: "locale" });
  const result = addBooking(db, input("2026-11-07T14:00", { email: "", phone: "" }), { now: NOW });
  expect(result).toMatchObject({ ok: true, booking: { email: "", phone: "", decisionMailedAt: NOW } });
});

test("with an email the approval email is due after UNDO_MS; with no email it never is", () => {
  const { db, input } = setup();
  const withEmail = addBooking(db, input("2026-11-07T14:00"), { now: NOW });
  addBooking(db, input("2026-11-07T16:00", { email: "" }), { now: NOW });
  if (!withEmail.ok) throw new Error(withEmail.reason);
  expect(claimDueDecisions(db, NOW + UNDO_MS - 1)).toEqual([]);
  expect(claimDueDecisions(db, NOW + UNDO_MS).map((b) => b.id)).toEqual([withEmail.booking.id]);
  expect(claimDueDecisions(db, NOW + 10 * UNDO_MS)).toEqual([]);
});

test("monthMoney counts the added booking as open, and as paid after markPaid", () => {
  const { db, input } = setup();
  const result = addBooking(db, input("2026-11-07T14:00"), { now: NOW });
  if (!result.ok) throw new Error(result.reason);
  expect(monthMoney(db, "2026-11")).toEqual({ count: 1, paidCents: 0, openCents: 6000 });
  markPaid(db, result.booking.id, NOW);
  expect(monthMoney(db, "2026-11")).toEqual({ count: 1, paidCents: 6000, openCents: 0 });
});
