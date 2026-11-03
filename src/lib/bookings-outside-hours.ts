// The coming bookings that fall outside the open hours of a rule (#712, epic #711 nina:holiday): the hours page names
// them after a change. Own code: it uses `openRanges()` and the query pattern of `cancelDay()` (#692).
import { and, gt, inArray, isNull } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Db } from "@/db";
import type { Booking } from "@/db/bookings";
import { bookings } from "@/db/schema";
import { type HoursRule, openRanges, TIME_ZONE } from "@/lib/hours";

/**
 * Each `requested` and `approved` booking that has not ended at `now` and is not forgotten, and is not inside one open
 * range of `rule`, sorted by start. The check uses the open ranges of the days the bookings touch (one day before and
 * after, so a booking that ends after closing time is still checked against its own day).
 */
export function bookingsOutsideHours(db: Db, rule: HoursRule, { now = Date.now() }: { now?: number } = {}): Booking[] {
  const coming = db
    .select()
    .from(bookings)
    .where(
      and(inArray(bookings.status, ["requested", "approved"]), gt(bookings.end, now), isNull(bookings.forgottenAt)),
    )
    .orderBy(bookings.start)
    .all();
  if (coming.length === 0) return [];
  const first = DateTime.fromMillis(coming[0].start, { zone: TIME_ZONE }).minus({ days: 1 }).toISODate();
  const last = DateTime.fromMillis(Math.max(...coming.map((b) => b.end)), { zone: TIME_ZONE })
    .plus({ days: 1 })
    .toISODate();
  if (!first || !last) throw new RangeError("A booking has no valid local date");
  const ranges = openRanges(rule, first, last);
  return coming.filter((b) => !ranges.some((r) => r.start <= b.start && b.end <= r.end));
}
