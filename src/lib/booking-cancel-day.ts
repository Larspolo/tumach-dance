// Nina is sick (#692, epic #690): cancel each booking of one Amsterdam day and close the day. Own code: no library
// does this; it uses `cancelBooking()` and the hours rule. No email in `cancelDay()`: `sendCancelDayEmails()` sends them.
import { and, gt, gte, inArray, isNull, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Db } from "@/db";
import { type Booking, cancelBooking } from "@/db/bookings";
import { bookings } from "@/db/schema";
import { sendCancelEmail } from "@/lib/booking-email";
import { TIME_ZONE } from "@/lib/hours";
import { getHoursRule, saveHoursRule } from "@/lib/hours-store";

export type CancelDayResult =
  | { ok: true; cancelled: { booking: Booking; wasApproved: boolean }[] }
  | { ok: false; reason: "date" };

/**
 * Cancel each `requested` and `approved` booking that starts on the Amsterdam date `date` ("YYYY-MM-DD") and has not
 * ended at `now` and is not forgotten, and add the date to `closed` of the hours rule (once). The day ends at the start
 * of the next date (a day of a change of summer time has 23 or 25 hours). A wrong date changes nothing.
 */
export function cancelDay(db: Db, date: string, { now = Date.now() }: { now?: number } = {}): CancelDayResult {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? DateTime.fromISO(date, { zone: TIME_ZONE }) : null;
  if (!day?.isValid || day.toISODate() !== date) return { ok: false, reason: "date" };
  const from = day.startOf("day").toMillis();
  const to = day.plus({ days: 1 }).startOf("day").toMillis();
  return db.transaction(() => {
    const rows = db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, ["requested", "approved"]),
          gte(bookings.start, from),
          lt(bookings.start, to),
          gt(bookings.end, now),
          isNull(bookings.forgottenAt),
        ),
      )
      .orderBy(bookings.start)
      .all();
    const cancelled: { booking: Booking; wasApproved: boolean }[] = [];
    for (const { id } of rows) {
      const result = cancelBooking(db, id, "nina");
      if (result.ok) cancelled.push({ booking: result.booking, wasApproved: result.wasApproved });
    }
    const rule = getHoursRule(db);
    const closed = rule.closed ?? [];
    if (!closed.some((c) => c.from <= date && date <= (c.to ?? c.from))) {
      saveHoursRule(db, { ...rule, closed: [...closed, { from: date }] });
    }
    return { ok: true as const, cancelled };
  });
}

/** Email each dancer of the bookings that `cancelDay()` cancelled (#709): the cancel email of each, by Nina. */
export async function sendCancelDayEmails(
  db: Db,
  cancelled: { booking: Booking; wasApproved: boolean }[],
): Promise<void> {
  for (const { booking, wasApproved } of cancelled) await sendCancelEmail(db, booking, "nina", wasApproved);
}
