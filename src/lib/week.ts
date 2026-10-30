// The week of the studio app (#102): Monday to Sunday in Europe/Amsterdam.
import { DateTime } from "luxon";
import { TIME_ZONE } from "./hours";

export type Week = {
  /** The Monday, YYYY-MM-DD. */
  start: string;
  /** The seven dates, Monday to Sunday, YYYY-MM-DD. */
  days: string[];
  /** The first instant of the Monday and of the next Monday, in milliseconds (UTC). */
  from: number;
  to: number;
  previous: string;
  next: string;
};

/** The week of `date` (YYYY-MM-DD); a missing or wrong date gives the week of `now`. */
export function weekOf(date: string | undefined, now: number = Date.now()): Week {
  let day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? DateTime.fromISO(date, { zone: TIME_ZONE }) : null;
  if (!day?.isValid) day = DateTime.fromMillis(now, { zone: TIME_ZONE });
  const monday = day.startOf("day").minus({ days: day.weekday - 1 });
  const days = Array.from({ length: 7 }, (_, i) => monday.plus({ days: i }).toISODate() as string);
  return {
    start: days[0],
    days,
    from: monday.toMillis(),
    to: monday.plus({ weeks: 1 }).toMillis(),
    previous: monday.minus({ weeks: 1 }).toISODate() as string,
    next: monday.plus({ weeks: 1 }).toISODate() as string,
  };
}

/** The date (YYYY-MM-DD) of an instant in Europe/Amsterdam. */
export function localDate(instant: number): string {
  return DateTime.fromMillis(instant, { zone: TIME_ZONE }).toISODate() as string;
}
