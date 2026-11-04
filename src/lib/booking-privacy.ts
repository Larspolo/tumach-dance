// The removal of the personal data of old bookings (#224, epoch #222 `book:privacy`): the name, email and phone of a
// booking that ended more than `KEEP_MONTHS` ago. The offer, the time, the status and the payment stay for the counts.
import { and, isNull, lt, type SQL, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Db } from "../db";
import { forgetDancerNotes, pruneDancerNotes } from "../db/dancer-notes";
import { bookings } from "../db/schema";
import { TIME_ZONE } from "./hours";
import { dancerWhere } from "./same-dancer";

/** The months that the site keeps the personal data of a booking after its end. Nina's answer can change it. */
export const KEEP_MONTHS = 12;

/** Clear the personal data of each old booking that still has it; give the ids. A second call changes nothing. */
export function forgetOldBookings(db: Db, now = Date.now()): number[] {
  const limit = DateTime.fromMillis(now, { zone: TIME_ZONE }).minus({ months: KEEP_MONTHS }).toMillis();
  const ids = db
    .update(bookings)
    .set({
      name: "",
      email: "",
      phone: "",
      note: null,
      // A new secret per row (the column is unique): the cancel link of the old email then finds nothing.
      cancelToken: sql`lower(hex(randomblob(32)))`,
      forgottenAt: now,
    })
    .where(and(lt(bookings.end, limit), isNull(bookings.forgottenAt)))
    .returning({ id: bookings.id })
    .all()
    .map((row) => row.id);
  // Nina's note about a dancer goes when no booking of the dancer keeps its data (#695); a newer booking keeps it.
  if (ids.length > 0) pruneDancerNotes(db);
  return ids;
}

/**
 * Clear the personal data of each booking of one dancer (by email, any case) that still has it, past and coming;
 * give the ids. The offer, time, status and payment stay. It does not cancel: the caller cancels first.
 * An empty email changes nothing.
 */
export function forgetDancer(db: Db, email: string, now = Date.now()): number[] {
  if (email.trim() === "") return [];
  return forgetWhere(db, dancerWhere({ id: -1, email, phone: "" }), now);
}

/** Clear the personal data of each booking that matches `where` (see `dancerWhere`) and still has it; give the ids. */
export function forgetWhere(db: Db, where: SQL, now = Date.now()): number[] {
  const filter = and(where, isNull(bookings.forgottenAt));
  // Nina's note about this dancer goes too (#695): the keys of the rows before they lose the email and the phone.
  forgetDancerNotes(db, db.select({ email: bookings.email, phone: bookings.phone }).from(bookings).where(filter).all());
  return db
    .update(bookings)
    .set({
      name: "",
      email: "",
      phone: "",
      note: null,
      cancelToken: sql`lower(hex(randomblob(32)))`,
      forgottenAt: now,
    })
    .where(filter)
    .returning({ id: bookings.id })
    .all()
    .map((row) => row.id);
}
