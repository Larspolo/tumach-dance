// The reminder email the day before an approved booking (#165). The booking timer (`booking-timer.ts`) checks every
// 5 minutes. "The day before" is the same Amsterdam wall time one day earlier: 23 or 25 hours before the start on the
// day of the change to or from summer time. A booking that was requested after that moment gets no reminder: the
// dancer booked it less than a day before, and the request and approval emails are fresh.
// One `UPDATE` sets `remindedAt` before the send, so two checks at once and a check after a restart send no second
// reminder. A failed send clears it again: the next check tries again.
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Db } from "../db";
import { bookings, offers } from "../db/schema";
import { reminderEmail } from "./booking-email";
import { sendEmail } from "./email";
import { TIME_ZONE } from "./hours";

/** The longest local day (the end of summer time): the bookings that can be due start at most this long after now. */
const MAX_DAY_MS = 25 * 60 * 60_000;

/** The moment of the reminder of a booking that starts at `start`: the same Amsterdam time one day before. */
export function reminderDue(start: number): number {
  return DateTime.fromMillis(start, { zone: TIME_ZONE }).minus({ days: 1 }).toMillis();
}

/** Send the reminder of each approved booking that is due and has had none. Gives the ids of the reminded bookings. */
export async function checkReminders(db: Db, now = Date.now()): Promise<number[]> {
  const rows = db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(
      and(
        eq(bookings.status, "approved"),
        isNull(bookings.remindedAt),
        gt(bookings.start, now),
        lte(bookings.start, now + MAX_DAY_MS),
      ),
    )
    .all();
  const sent: number[] = [];
  for (const { booking, offer } of rows) {
    const due = reminderDue(booking.start);
    if (now < due || booking.createdAt > due) continue;
    const claimed = db
      .update(bookings)
      .set({ remindedAt: now })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, "approved"), isNull(bookings.remindedAt)))
      .returning()
      .get();
    if (!claimed) continue;
    try {
      await sendEmail(reminderEmail(claimed, offer));
    } catch (error) {
      db.update(bookings).set({ remindedAt: null }).where(eq(bookings.id, booking.id)).run();
      throw error;
    }
    sent.push(booking.id);
  }
  return sent;
}
