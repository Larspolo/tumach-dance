// The removal of the personal data of old bookings (#224, epoch #222 `book:privacy`): the name, email and phone of a
// booking that ended more than `KEEP_MONTHS` ago. The offer, the time, the status and the payment stay for the counts.
import { and, isNull, lt, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Db } from "../db";
import { bookings } from "../db/schema";
import { TIME_ZONE } from "./hours";

/** The months that the site keeps the personal data of a booking after its end. Nina's answer can change it. */
export const KEEP_MONTHS = 12;

/** Clear the personal data of each old booking that still has it; give the ids. A second call changes nothing. */
export function forgetOldBookings(db: Db, now = Date.now()): number[] {
  const limit = DateTime.fromMillis(now, { zone: TIME_ZONE }).minus({ months: KEEP_MONTHS }).toMillis();
  return db
    .update(bookings)
    .set({
      name: "",
      email: "",
      phone: "",
      // A new secret per row (the column is unique): the cancel link of the old email then finds nothing.
      cancelToken: sql`lower(hex(randomblob(32)))`,
      forgottenAt: now,
    })
    .where(and(lt(bookings.end, limit), isNull(bookings.forgottenAt)))
    .returning({ id: bookings.id })
    .all()
    .map((row) => row.id);
}
