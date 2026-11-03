import { DateTime } from "luxon";
import type { Db } from "@/db";
import { listBookings } from "@/db/bookings";
import { TIME_ZONE } from "@/lib/hours";

export type MonthMoney = { count: number; paidCents: number; openCents: number };

/** The current month in Amsterdam time, `"YYYY-MM"`. */
export function currentMonth(now = Date.now()): string {
  return DateTime.fromMillis(now, { zone: TIME_ZONE }).toFormat("yyyy-MM");
}

/** The first instant of the month and of the next month in Amsterdam time, UTC epoch milliseconds. */
export function monthRange(month: string): { from: number; to: number } {
  const start = DateTime.fromISO(`${month}-01`, { zone: TIME_ZONE }).startOf("month");
  if (!start.isValid) throw new Error(`bad month: ${month}`);
  return { from: start.toMillis(), to: start.plus({ months: 1 }).toMillis() };
}

/** The first instant of the year and of the next year in Amsterdam time, UTC epoch milliseconds. */
export function yearRange(year: number): { from: number; to: number } {
  const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: TIME_ZONE }).startOf("year");
  if (!start.isValid) throw new Error(`bad year: ${year}`);
  return { from: start.toMillis(), to: start.plus({ years: 1 }).toMillis() };
}

/** The money of the approved bookings whose start is in `[from, to)`: the sum of the paid ones and of the rest. */
function rangeMoney(db: Db, from: number, to: number): MonthMoney {
  const result: MonthMoney = { count: 0, paidCents: 0, openCents: 0 };
  // listBookings gives each booking that overlaps the range: keep only a start inside the range.
  for (const { booking } of listBookings(db, from, to, ["approved"])) {
    if (booking.start < from || booking.start >= to) continue;
    result.count += 1;
    if (booking.paidAt !== null) result.paidCents += booking.priceCents;
    else result.openCents += booking.priceCents;
  }
  return result;
}

/**
 * The money of one month (#597): the `approved` bookings whose start is in the month in Amsterdam time, the sum of the
 * paid ones and the sum of the rest. `month` = `"YYYY-MM"`.
 */
export function monthMoney(db: Db, month: string): MonthMoney {
  const { from, to } = monthRange(month);
  return rangeMoney(db, from, to);
}

/** The money of one year (#627): as `monthMoney()`, for the bookings whose start is in the year in Amsterdam time. */
export function yearMoney(db: Db, year: number): MonthMoney {
  const { from, to } = yearRange(year);
  return rangeMoney(db, from, to);
}

export type MonthNav = { month: string; previous: string; next: string };

/**
 * The month of the money page (#598) from `?month=YYYY-MM`, with the month before and after. A wrong or missing value
 * gives the current month in Amsterdam time.
 */
export function monthOf(param: string | undefined, now = Date.now()): MonthNav {
  let start = DateTime.fromMillis(now, { zone: TIME_ZONE }).startOf("month");
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const asked = DateTime.fromFormat(param, "yyyy-MM", { zone: TIME_ZONE });
    if (asked.isValid) start = asked.startOf("month");
  }
  return {
    month: start.toFormat("yyyy-MM"),
    previous: start.minus({ months: 1 }).toFormat("yyyy-MM"),
    next: start.plus({ months: 1 }).toFormat("yyyy-MM"),
  };
}
