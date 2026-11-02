import { and, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { cancelBooking } from "@/db/bookings";
import { bookings } from "@/db/schema";
import { sendCancelEmail } from "@/lib/booking-email";
import { forgetDancer } from "@/lib/booking-privacy";

/**
 * Remove the data of the dancer of booking `id` (#363, epic #358): first cancel each coming requested or approved
 * booking of the same email (any case) and send the cancel email, so the dancer knows and the time is free again;
 * then remove the name, email and phone of each booking of that dancer (`forgetDancer`). Gives the removed ids.
 * A booking with no email (already removed) changes nothing.
 */
export async function forgetDancerOfBooking(db: Db, id: number, now = Date.now()): Promise<number[]> {
  const booking = db.select().from(bookings).where(sql`${bookings.id} = ${id}`).get();
  const key = booking?.email.trim().toLowerCase() ?? "";
  if (key === "") return [];
  const coming = db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        sql`lower(${bookings.email}) = ${key}`,
        inArray(bookings.status, ["requested", "approved"]),
        gt(bookings.start, now),
      ),
    )
    .all();
  for (const row of coming) {
    const result = cancelBooking(db, row.id);
    if (result.ok) await sendCancelEmail(db, result.booking);
  }
  return forgetDancer(db, key, now);
}
