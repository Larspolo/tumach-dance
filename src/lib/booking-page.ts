// The free times of the booking page (#36): the open hours minus the held bookings, from now plus the notice.
import { DateTime } from "luxon";
import { busyRanges } from "../db/bookings";
import { listClassTimes } from "../db/classes";
import type { Db } from "../db/index";
import type { Offer } from "../db/offers";
import { notBefore } from "./booking-notice";
import { classRanges } from "./class-ranges";
import { type OpenRange, openRanges, TIME_ZONE } from "./hours";
import { getHoursRule } from "./hours-store";
import { freeSlots } from "./slots";

/** The days that the page shows: today and the next 4 weeks. */
export const BOOKING_DAYS = 28;
/** How far after the 4 weeks the page looks for the next free time (#478). */
export const NEXT_FREE_DAYS = 84;

export type BookingDay = { date: string; slots: OpenRange[] };

/**
 * Each day of the next 4 weeks (local dates "YYYY-MM-DD") with its free slots for the offer; a day can have none.
 * `except`: a booking whose own time counts as free (the move of Nina, #411; the same rule as `moveBooking()`).
 */
export function bookingDays(
  db: Db,
  offer: Offer,
  now: number = Date.now(),
  { except }: { except?: number } = {},
): BookingDay[] {
  return daysFrom(db, offer, now, startOfDay(now), BOOKING_DAYS, { except });
}

/**
 * The first day after the 4 weeks with a free time, and the first day from which the page shows it (#478).
 * Null when none of the next 84 days has a free time.
 */
export function nextFreeDate(db: Db, offer: Offer, now: number = Date.now()): { date: string; from: string } | null {
  const after = startOfDay(now).plus({ days: BOOKING_DAYS });
  const day = daysFrom(db, offer, now, after, NEXT_FREE_DAYS).find((d) => d.slots.length > 0);
  if (!day) return null;
  const from = DateTime.fromISO(day.date, { zone: TIME_ZONE }).minus({ days: BOOKING_DAYS - 1 });
  return { date: day.date, from: from.toISODate() as string };
}

function startOfDay(now: number): DateTime {
  return DateTime.fromMillis(now, { zone: TIME_ZONE }).startOf("day");
}

/** `count` local days from `first`, each with its free slots for the offer (the rule of `bookingDays()`). */
function daysFrom(
  db: Db,
  offer: Offer,
  now: number,
  first: DateTime,
  count: number,
  { except }: { except?: number } = {},
): BookingDay[] {
  const dates = Array.from({ length: count }, (_, i) => first.plus({ days: i }).toISODate() as string);
  const open = openRanges(getHoursRule(db), dates[0], dates[dates.length - 1]);
  const from = open[0]?.start ?? now;
  const to = open[open.length - 1]?.end ?? now;
  // A class uses the room: its times of the page are busy too (#99). A hidden class blocks nothing.
  const classes = classRanges(listClassTimes(db, { visibleOnly: true }), dates[0], dates[dates.length - 1]);
  const slots = freeSlots(open, [...busyRanges(db, from, to, { except }), ...classes], offer.minutes, {
    notBefore: notBefore(now),
  });
  return dates.map((date) => ({
    date,
    slots: slots.filter((s) => DateTime.fromMillis(s.start, { zone: TIME_ZONE }).toISODate() === date),
  }));
}
