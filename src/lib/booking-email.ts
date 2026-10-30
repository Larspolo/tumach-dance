// The email to a dancer after a booking request (#37): the offer, the time, and that Nina answers soon.
// The email after Nina's decision (#77): approved or declined, with the same offer and time.
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

/** The translator of `locale` (English for another one), the label of the offer and the Amsterdam time of `booking`. */
function parts(booking: Booking, offer: Offer, locale: string) {
  const lang = locale in MESSAGES ? (locale as keyof typeof MESSAGES) : "en";
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  const offerLabel =
    offer.kind === "lesson"
      ? t("Book.lesson", { minutes: offer.minutes })
      : t("Book.rental", { minutes: offer.minutes });
  const when = new Intl.DateTimeFormat(lang, { timeZone: TIME_ZONE, dateStyle: "full", timeStyle: "short" }).format(
    new Date(booking.start),
  );
  return { t, offerLabel, when };
}

/** The email to the dancer of a `requested` booking, in the language of the page (`locale`). */
export function requestEmail(booking: Booking, offer: Offer, locale: string): Email {
  const { t, offerLabel, when } = parts(booking, offer, locale);
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

export type Decision = "approved" | "declined";

/** The email to the dancer after Nina's decision, in the language of the booking (`booking.locale`). */
export function decisionEmail(booking: Booking, offer: Offer, decision: Decision): Email {
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const lines =
    decision === "approved"
      ? [
          t("bookingEmail.approvedBody", { offer: offerLabel, when }),
          // The payment link of `book:pay` (#142) goes here, between the confirmation and the goodbye.
          "",
          t("bookingEmail.approvedSee"),
        ]
      : [t("bookingEmail.declinedBody", { offer: offerLabel, when }), "", t("bookingEmail.declinedOther")];
  const text = [t("bookingEmail.greeting", { name: booking.name }), "", ...lines, "", t("bookingEmail.sign")].join(
    "\n",
  );
  const subject = decision === "approved" ? t("bookingEmail.approvedSubject") : t("bookingEmail.declinedSubject");
  return { to: booking.email, subject, text };
}

/** The email to the dancer after Nina cancelled a booking (#160), in the language of the booking. */
export function cancelEmail(booking: Booking, offer: Offer): Email {
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const text = [
    t("bookingEmail.greeting", { name: booking.name }),
    "",
    t("bookingEmail.cancelled", { offer: offerLabel, when }),
    "",
    t("bookingEmail.sign"),
  ].join("\n");
  return { to: booking.email, subject: t("bookingEmail.cancelledSubject"), text };
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

/**
 * Send the decision email after `decideBooking()` gave `ok`. A failed email does not undo the decision: the error is
 * logged, and Nina's decision stays.
 */
export async function sendDecisionEmail(db: Db, booking: Booking, decision: Decision): Promise<void> {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, booking.offerId)).get();
    if (!offer) throw new Error(`Booking email: offer ${booking.offerId} not found`);
    await sendEmail(decisionEmail(booking, offer, decision));
  } catch (error) {
    console.error(`[booking-email] the decision email of booking ${booking.id} failed:`, error);
  }
}

/**
 * Send the cancel email after a booking is cancelled. A failed email does not undo the cancellation: the error is
 * logged, and the cancelled booking stays.
 */
export async function sendCancelEmail(db: Db, booking: Booking): Promise<void> {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, booking.offerId)).get();
    if (!offer) throw new Error(`Booking email: offer ${booking.offerId} not found`);
    await sendEmail(cancelEmail(booking, offer));
  } catch (error) {
    console.error(`[booking-email] the cancel email of booking ${booking.id} failed:`, error);
  }
}
