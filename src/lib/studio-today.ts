// The approved lessons of today and of tomorrow for the studio home (#660, epic #658), in Europe/Amsterdam time.
import { DateTime } from "luxon";
import type { Db } from "@/db";
import { type Booking, listBookings } from "@/db/bookings";
import type { Offer } from "@/db/offers";
import { TIME_ZONE } from "@/lib/hours";

export type DayLesson = { booking: Booking; offer: Offer };

/**
 * The approved bookings of today and of tomorrow, by start. A lesson of today that has ended stays in `today`;
 * a lesson that started yesterday is in neither list.
 */
export function lessonsOfDays(db: Db, now = Date.now()): { today: DayLesson[]; tomorrow: DayLesson[] } {
  const startOfToday = DateTime.fromMillis(now, { zone: TIME_ZONE }).startOf("day");
  const startOfTomorrow = startOfToday.plus({ days: 1 });
  const startOfDayAfterTomorrow = startOfToday.plus({ days: 2 });
  const from = startOfToday.toMillis();
  const tomorrowFrom = startOfTomorrow.toMillis();
  const to = startOfDayAfterTomorrow.toMillis();
  const lessons = listBookings(db, from, to, ["approved"]).filter(({ booking }) => booking.start >= from);
  return {
    today: lessons.filter(({ booking }) => booking.start < tomorrowFrom),
    tomorrow: lessons.filter(({ booking }) => booking.start >= tomorrowFrom),
  };
}
