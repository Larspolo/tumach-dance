import { and, gt, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { cancelBooking } from "@/db/bookings";
import { bookings } from "@/db/schema";
import { sendCancelEmail } from "@/lib/booking-email";
import { forgetWhere } from "@/lib/booking-privacy";
import { dancerWhere } from "@/lib/same-dancer";

/**
 * Remove the data of the dancer of booking `id` (#363, epic #358): first cancel each coming requested or approved
 * booking of the same dancer (`dancerWhere`: the email, else the phone digits, #620) and send the cancel email (none
 * with no email), so the dancer knows and the time is free again; then remove the name, email and phone of each
 * booking of that dancer. Gives the removed ids. An already removed booking changes nothing.
 */
export async function forgetDancerOfBooking(db: Db, id: number, now = Date.now()): Promise<number[]> {
  const booking = db.select().from(bookings).where(sql`${bookings.id} = ${id}`).get();
  if (!booking || booking.forgottenAt !== null) return [];
  const where = dancerWhere(booking);
  const coming = db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        where,
        isNull(bookings.forgottenAt),
        inArray(bookings.status, ["requested", "approved"]),
        gt(bookings.start, now),
      ),
    )
    .all();
  for (const row of coming) {
    const result = cancelBooking(db, row.id);
    if (result.ok) await sendCancelEmail(db, result.booking);
  }
  return forgetWhere(db, where, now);
}
