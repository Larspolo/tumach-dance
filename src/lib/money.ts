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

/**
 * The money of one month (#597): the `approved` bookings whose start is in the month in Amsterdam time, the sum of the
 * paid ones and the sum of the rest. `month` = `"YYYY-MM"`.
 */
export function monthMoney(db: Db, month: string): MonthMoney {
  const { from, to } = monthRange(month);
  const result: MonthMoney = { count: 0, paidCents: 0, openCents: 0 };
  // listBookings gives each booking that overlaps the range: keep only a start inside the month.
  for (const { booking } of listBookings(db, from, to, ["approved"])) {
    if (booking.start < from || booking.start >= to) continue;
    result.count += 1;
    if (booking.paidAt !== null) result.paidCents += booking.priceCents;
    else result.openCents += booking.priceCents;
  }
  return result;
}
