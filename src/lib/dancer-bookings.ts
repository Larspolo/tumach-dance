// The other bookings of the dancer of one booking, for the page of a booking (#622, epic #621).
import { and, desc, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import type { Booking } from "@/db/bookings";
import type { Offer } from "@/db/offers";
import { bookings, offers } from "@/db/schema";
import { dancerWhere, phoneDigits } from "@/lib/same-dancer";

/**
 * The other bookings of the dancer of the booking `id` (the rule of `dancerWhere()`, #620), all statuses, newest first,
 * at most `limit`, each with its offer. A removed dancer (`forgottenAt`), or a booking with neither email nor phone,
 * gives no bookings.
 */
export function dancerBookings(
  db: Db,
  id: number,
  { limit = 20 }: { limit?: number } = {},
): { booking: Booking; offer: Offer }[] {
  const anchor = db.select().from(bookings).where(eq(bookings.id, id)).get();
  if (!anchor || anchor.forgottenAt !== null) return [];
  if (anchor.email.trim() === "" && phoneDigits(anchor.phone) === "") return [];
  return db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(and(dancerWhere(anchor), ne(bookings.id, id)))
    .orderBy(desc(bookings.start))
    .limit(limit)
    .all();
}
