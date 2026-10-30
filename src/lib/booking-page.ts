// The free times of the booking page (#36): the open hours minus the held bookings, from now plus the notice.
import { DateTime } from "luxon";
import { busyRanges } from "../db/bookings";
import type { Db } from "../db/index";
import type { Offer } from "../db/offers";
import { notBefore } from "./booking-notice";
import { type OpenRange, openRanges, TIME_ZONE } from "./hours";
import { getHoursRule } from "./hours-store";
import { freeSlots } from "./slots";

/** The days that the page shows: today and the next 4 weeks. */
export const BOOKING_DAYS = 28;

export type BookingDay = { date: string; slots: OpenRange[] };

/** Each day of the next 4 weeks (local dates "YYYY-MM-DD") with its free slots for the offer; a day can have none. */
export function bookingDays(db: Db, offer: Offer, now: number = Date.now()): BookingDay[] {
  const first = DateTime.fromMillis(now, { zone: TIME_ZONE }).startOf("day");
  const dates = Array.from({ length: BOOKING_DAYS }, (_, i) => first.plus({ days: i }).toISODate() as string);
  const open = openRanges(getHoursRule(db), dates[0], dates[dates.length - 1]);
  const from = open[0]?.start ?? now;
  const to = open[open.length - 1]?.end ?? now;
  const slots = freeSlots(open, busyRanges(db, from, to), offer.minutes, { notBefore: notBefore(now) });
  return dates.map((date) => ({
    date,
    slots: slots.filter((s) => DateTime.fromMillis(s.start, { zone: TIME_ZONE }).toISODate() === date),
  }));
}
