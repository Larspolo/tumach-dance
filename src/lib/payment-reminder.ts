// The payment reminder of `book:pay` (#167): one email to a dancer who did not pay an approved booking. The booking
// timer (`booking-timer.ts`) checks every 5 minutes. It is due 2 days after Nina's approval (time for the Tikkie of
// the approval email or of her bank app), but at the latest 1 day before the start, and never sooner than 2 hours
// after the approval (Nina marks a payment paid by hand, #143: give her time to see it). After the start: no reminder.
// One `UPDATE` sets `paymentRemindedAt` before the send, so a second check or a check after a restart sends no second
// reminder. A failed send clears it again: the next check tries again.
import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "../db";
import { bookings, offers } from "../db/schema";
import { paymentReminderEmail } from "./booking-email";
import { sendEmail } from "./email";

const HOUR = 60 * 60_000;
export const AFTER_APPROVAL_MS = 48 * HOUR;
export const BEFORE_START_MS = 24 * HOUR;
export const MIN_AFTER_APPROVAL_MS = 2 * HOUR;

/** The moment of the payment reminder of a booking approved at `approvedAt` that starts at `start`. */
export function paymentReminderDue(approvedAt: number, start: number): number {
  return Math.max(
    approvedAt + MIN_AFTER_APPROVAL_MS,
    Math.min(approvedAt + AFTER_APPROVAL_MS, start - BEFORE_START_MS),
  );
}

/** Send the payment reminder of each approved, unpaid booking that is due and has had none. Gives the ids. */
export async function checkPaymentReminders(db: Db, now = Date.now()): Promise<number[]> {
  const unpaid = and(eq(bookings.status, "approved"), isNull(bookings.paidAt), isNull(bookings.paymentRemindedAt));
  const rows = db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(and(unpaid, isNotNull(bookings.approvedAt), gt(bookings.start, now)))
    .all();
  const sent: number[] = [];
  for (const { booking, offer } of rows) {
    if (now < paymentReminderDue(booking.approvedAt as number, booking.start)) continue;
    const claimed = db
      .update(bookings)
      .set({ paymentRemindedAt: now })
      .where(and(eq(bookings.id, booking.id), unpaid))
      .returning()
      .get();
    if (!claimed) continue;
    try {
      await sendEmail(paymentReminderEmail(claimed, offer));
    } catch (error) {
      db.update(bookings).set({ paymentRemindedAt: null }).where(eq(bookings.id, booking.id)).run();
      throw error;
    }
    sent.push(booking.id);
  }
  return sent;
}
