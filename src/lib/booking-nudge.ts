// The one extra push to Nina for a request that she did not answer 12 hours before its start (#594, epic nina:nudge).
// The booking timer (`booking-timer.ts`) checks every 5 minutes. Only a request of 2 hours or older, and only from
// 08:00 to 21:59 Amsterdam time: no push in the night. One `UPDATE` sets `nudgedAt` before the send, so two checks at
// once send one push. A failed push is logged and not sent again. An undone decision keeps `nudgedAt`: no second nudge.
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Db } from "../db";
import { bookings, offers } from "../db/schema";
import { nudgePush } from "./booking-push";
import { TIME_ZONE } from "./hours";
import { sendPush } from "./push";

const HOUR_MS = 60 * 60_000;
const BEFORE_START_MS = 12 * HOUR_MS;
const MIN_AGE_MS = 2 * HOUR_MS;
const FIRST_HOUR = 8;
const LAST_HOUR = 21;

/** Send the nudge of each request that still waits. Gives the ids of the nudged requests. */
export async function checkNudges(db: Db, now = Date.now()): Promise<number[]> {
  const hour = DateTime.fromMillis(now, { zone: TIME_ZONE }).hour;
  if (hour < FIRST_HOUR || hour > LAST_HOUR) return [];
  const rows = db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(
      and(
        eq(bookings.status, "requested"),
        isNull(bookings.nudgedAt),
        isNull(bookings.forgottenAt),
        gt(bookings.start, now),
        lte(bookings.start, now + BEFORE_START_MS),
        lte(bookings.createdAt, now - MIN_AGE_MS),
      ),
    )
    .all();
  const sent: number[] = [];
  for (const { booking, offer } of rows) {
    const claimed = db
      .update(bookings)
      .set({ nudgedAt: now })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, "requested"), isNull(bookings.nudgedAt)))
      .returning()
      .get();
    if (!claimed) continue;
    try {
      await sendPush(db, (locale) => nudgePush(claimed, offer, locale));
    } catch (error) {
      console.error(`[booking-nudge] the nudge of booking ${booking.id} failed:`, error);
    }
    sent.push(booking.id);
  }
  return sent;
}
