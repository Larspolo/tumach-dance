// The next bookings of a dancer (#743): from the secret token of one booking, the bookings that wait for Nina or that
// she approved, of the same dancer, from now on. The address carries only the token, never the personal data.
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import type { Booking } from "@/db/bookings";
import type { Offer } from "@/db/offers";
import { bookings, offers } from "@/db/schema";
import { TOKEN } from "@/lib/booking-cancel";
import { dancerWhere } from "@/lib/same-dancer";

/**
 * The bookings with status `requested` or `approved` and a start after `now`, of the same dancer (same email, any
 * case) as the booking of `token`, by start, each with its offer. `[]` for a wrong or unknown token, a forgotten
 * booking or a booking with no email.
 */
export function mineBookings(db: Db, token: string, now = Date.now()): { booking: Booking; offer: Offer }[] {
  if (!TOKEN.test(token)) return [];
  const anchor = db.select().from(bookings).where(eq(bookings.cancelToken, token)).get();
  if (!anchor || anchor.forgottenAt !== null || anchor.email.trim() === "") return [];
  return db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(and(dancerWhere(anchor), inArray(bookings.status, ["requested", "approved"]), gt(bookings.start, now)))
    .orderBy(asc(bookings.start))
    .all();
}

/** The address of the page with the next bookings of the dancer of `booking` (only the token, and the locale). */
export function mineUrl(origin: string, booking: Pick<Booking, "locale" | "cancelToken">): string {
  const url = new URL(`/${booking.locale}/booking/mine`, origin);
  url.searchParams.set("token", booking.cancelToken);
  return url.toString();
}
