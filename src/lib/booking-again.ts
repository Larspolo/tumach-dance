// Book again (#724, epic #722): from the secret token of a booking, the offer and the name, email and phone of the
// dancer, so that the booking page can fill in its form. The address carries only the token, never the personal data.
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import type { Booking } from "../db/bookings";
import { bookings, offers } from "../db/schema";
import { TOKEN } from "./booking-cancel";

/** The fields of the booking form that a token gives. */
export type AgainFields = { offerId: number; name: string; email: string; phone: string };

/**
 * The fields of the booking of `token`, whatever its status (also cancelled or ended). `null` when the token is wrong
 * or unknown, when the offer is hidden, or when the booking is forgotten (its personal data is gone).
 */
export function againFields(db: Db, token: string): AgainFields | null {
  if (!TOKEN.test(token)) return null;
  const row = db
    .select({ booking: bookings, visible: offers.visible })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(eq(bookings.cancelToken, token))
    .get();
  if (!row?.visible) return null;
  const { booking } = row;
  if (booking.forgottenAt !== null) return null;
  return { offerId: booking.offerId, name: booking.name, email: booking.email, phone: booking.phone };
}

/** The address of the booking form that fills in the fields of `booking` (only the token, and the locale). */
export function againUrl(origin: string, booking: Pick<Booking, "locale" | "cancelToken">): string {
  const url = new URL(`/${booking.locale}/book`, origin);
  url.searchParams.set("again", booking.cancelToken);
  return url.toString();
}
