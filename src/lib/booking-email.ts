// The email to a dancer after a booking request (#37): the offer, the time, and that Nina answers soon.
// The texts are in `messages/` under `bookingEmail`; the time is in Europe/Amsterdam time, as Nina sees it.

import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import sl from "../../messages/sl.json";
import type { Db } from "../db";
import type { Booking } from "../db/bookings";
import type { Offer } from "../db/offers";
import { offers } from "../db/schema";
import { type Email, sendEmail } from "./email";
import { TIME_ZONE } from "./hours";

const MESSAGES = { en, nl, sl } as const;

/** The email to the dancer of a `requested` booking, in the language of the page (`locale`). */
export function requestEmail(booking: Booking, offer: Offer, locale: string): Email {
  const lang = locale in MESSAGES ? (locale as keyof typeof MESSAGES) : "en";
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  const offerLabel =
    offer.kind === "lesson"
      ? t("Book.lesson", { minutes: offer.minutes })
      : t("Book.rental", { minutes: offer.minutes });
  const when = new Intl.DateTimeFormat(lang, { timeZone: TIME_ZONE, dateStyle: "full", timeStyle: "short" }).format(
    new Date(booking.start),
  );
  const text = [
    t("bookingEmail.greeting", { name: booking.name }),
    "",
    t("bookingEmail.body", { offer: offerLabel, when }),
    "",
    t("bookingEmail.soon"),
    "",
    t("bookingEmail.sign"),
  ].join("\n");
  return { to: booking.email, subject: t("bookingEmail.subject"), text };
}

/**
 * Send the request email after `requestBooking()` gave `ok`. A failed email does not undo the booking: the error is
 * logged, and the dancer's request is still stored for Nina.
 */
export async function sendRequestEmail(db: Db, booking: Booking, locale: string): Promise<void> {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, booking.offerId)).get();
    if (!offer) throw new Error(`Booking email: offer ${booking.offerId} not found`);
    await sendEmail(requestEmail(booking, offer, locale));
  } catch (error) {
    console.error(`[booking-email] the email of booking ${booking.id} failed:`, error);
  }
}
