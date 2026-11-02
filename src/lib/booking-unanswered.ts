// The end of a request that Nina did not answer before its start (#340, P11: no new rule). The booking timer
// (`booking-timer.ts`) checks every 5 minutes. The request ends as `declined`: the cancel page and the privacy removal
// treat it as a declined request already. One `UPDATE` ends it before the send, so two checks at once send one
// email. A failed send keeps the request ended (no retry, as the reminder emails) and sends Nina one push (#421): she
// can tell the dancer by WhatsApp. A request that started more than 1 day ago ends with no email (the first start of this code on the live site must not send old emails).
import { and, eq, isNull, lte } from "drizzle-orm";
import type { Db } from "../db";
import { bookings, offers } from "../db/schema";
import { unansweredEmailHtml } from "./booking-email";
import { sendEmailFailPush } from "./booking-push";
import { sendEmail } from "./email";
import { recordError } from "./site-errors";

/** A request that started longer ago than this ends with no email. */
const LATE_MS = 24 * 60 * 60_000;

/** End each request that is not answered at its start, and email the dancer. Gives the ids of the ended requests. */
export async function checkUnanswered(db: Db, now = Date.now()): Promise<number[]> {
  const rows = db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(and(eq(bookings.status, "requested"), lte(bookings.start, now), isNull(bookings.forgottenAt)))
    .all();
  const ended: number[] = [];
  for (const { booking, offer } of rows) {
    const claimed = db
      .update(bookings)
      .set({ status: "declined" })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, "requested")))
      .returning()
      .get();
    if (!claimed) continue;
    if (now - booking.start <= LATE_MS) {
      try {
        await sendEmail(await unansweredEmailHtml(claimed, offer));
      } catch (error) {
        console.error(`unanswered email of booking ${booking.id} failed`, error);
        recordError("email: unanswered", error);
        await sendEmailFailPush(db, claimed, "unanswered");
      }
    }
    ended.push(booking.id);
  }
  return ended;
}
