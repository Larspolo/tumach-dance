// Nina cancels each booking of one day and closes it (#692, epic #690).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addBooking, cancelBooking, decideBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { cancelDay } from "../src/lib/booking-cancel-day";
import { bookingDays } from "../src/lib/booking-page";
import { getHoursRule, saveHoursRule } from "../src/lib/hours-store";

const ZONE = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone: ZONE }).toMillis();

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const add = (local: string, now: number) => {
    const r = addBooking(
      db,
      { offerId: offer.id, start: at(local), name: "Ana", email: "a@example.com", phone: "", locale: "nl" },
      { now },
    );
    if (!r.ok) throw new Error(`${local}: ${r.reason}`);
    return r.booking;
  };
  const status = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get()?.status;
  return { db, offer, add, status };
}

test("cancels the requested and approved bookings of the day, keeps the others, closes the day once", () => {
  const now = at("2026-11-03T12:00");
  const { db, offer, add, status } = setup();
  const approved = add("2026-11-07T11:00", now);
  const requested = add("2026-11-07T14:00", now);
  db.update(bookings).set({ status: "requested" }).where(eq(bookings.id, requested.id)).run();
  const declined = add("2026-11-07T16:00", now);
  db.update(bookings).set({ status: "requested" }).where(eq(bookings.id, declined.id)).run();
  decideBooking(db, declined.id, "declined", null, now);
  const old = add("2026-11-07T18:00", now);
  cancelBooking(db, old.id, "nina");
  const forgotten = add("2026-11-07T20:00", now);
  db.update(bookings).set({ forgottenAt: now }).where(eq(bookings.id, forgotten.id)).run();
  const before = add("2026-11-06T21:00", now);
  const after = add("2026-11-08T10:00", now);

  const result = cancelDay(db, "2026-11-07", { now });
  if (!result.ok) throw new Error(result.reason);
  expect(result.cancelled.map((c) => [c.booking.id, c.wasApproved])).toEqual([
    [approved.id, true],
    [requested.id, false],
  ]);
  expect(status(declined.id)).toBe("declined");
  expect(status(old.id)).toBe("cancelled");
  expect(status(forgotten.id)).toBe("approved");
  expect(status(before.id)).toBe("approved");
  expect(status(after.id)).toBe("approved");
  expect(getHoursRule(db).closed).toEqual([{ from: "2026-11-07" }]);
  const day = bookingDays(db, offer, now).find((d) => d.date === "2026-11-07");
  expect(day?.slots).toEqual([]);

  expect(cancelDay(db, "2026-11-07", { now })).toEqual({ ok: true, cancelled: [] });
  expect(getHoursRule(db).closed).toEqual([{ from: "2026-11-07" }]);
});

test("an ended booking of the day stays", () => {
  const { db, add, status } = setup();
  const ended = add("2026-11-07T10:00", at("2026-11-03T12:00"));
  const later = add("2026-11-07T15:00", at("2026-11-03T12:00"));
  const result = cancelDay(db, "2026-11-07", { now: at("2026-11-07T12:00") });
  expect(result.ok && result.cancelled.map((c) => c.booking.id)).toEqual([later.id]);
  expect(status(ended.id)).toBe("approved");
});

test("a date in a closed period is not added again", () => {
  const { db } = setup();
  const rule = getHoursRule(db);
  saveHoursRule(db, { ...rule, closed: [{ from: "2026-11-06", to: "2026-11-09" }] });
  cancelDay(db, "2026-11-07", { now: at("2026-11-03T12:00") });
  expect(getHoursRule(db).closed).toEqual([{ from: "2026-11-06", to: "2026-11-09" }]);
});

test("the day of the start of summer time has 23 hours", () => {
  const now = at("2027-03-20T12:00");
  const { db, add, status } = setup();
  // The default hours end at 22:00: move two bookings to the edges of the day.
  const late = add("2027-03-28T14:00", now);
  const next = add("2027-03-28T16:00", now);
  const move = (id: number, local: string) =>
    db
      .update(bookings)
      .set({ start: at(local), end: at(local) + 3_600_000 })
      .where(eq(bookings.id, id))
      .run();
  move(late.id, "2027-03-28T23:30");
  move(next.id, "2027-03-29T00:30");
  const result = cancelDay(db, "2027-03-28", { now });
  expect(result.ok && result.cancelled.map((c) => c.booking.id)).toEqual([late.id]);
  expect(status(next.id)).toBe("approved");
});

test("a wrong date changes nothing", () => {
  const now = at("2026-11-03T12:00");
  const { db, add, status } = setup();
  const b = add("2026-11-07T11:00", now);
  for (const date of ["2026-02-30", "2026-11-7", "tomorrow", ""]) {
    expect(cancelDay(db, date, { now })).toEqual({ ok: false, reason: "date" });
  }
  expect(status(b.id)).toBe("approved");
  expect(getHoursRule(db).closed ?? []).toEqual([]);
});
