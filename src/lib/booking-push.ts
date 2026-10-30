// The push to Nina for each new booking request (#75): the dancer, the offer and the time, with a link to the
// requests page. Each device gets the push in the language of its studio app (`sendPush` with a function): the
// server action has the request of the dancer, not of Nina, so `studioLocale()` of that request is the wrong one.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import sl from "../../messages/sl.json";
import type { Db } from "../db";
import type { Booking } from "../db/bookings";
import type { Offer } from "../db/offers";
import { offers } from "../db/schema";
import { withFallback } from "../i18n/fallback";
import { TIME_ZONE } from "./hours";
import { type PushLocale, type PushMessage, sendPush } from "./push";
import { weekOf } from "./week";

export const BOOKINGS_PATH = "/studio/bookings";

const MESSAGES = { en, nl: withFallback(nl, en), sl: withFallback(sl, en) };

/** The push of a `requested` booking in the language `locale` of Nina's studio app. */
export function requestPush(booking: Booking, offer: Offer, locale: PushLocale): PushMessage {
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  return { title: t("bookingPush.title"), body: pushBody(booking, offer, locale), url: BOOKINGS_PATH };
}

/** The push of a booking that the dancer cancelled with the link (#210), with a link to the week of the booking. */
export function cancelPush(booking: Booking, offer: Offer, locale: PushLocale): PushMessage {
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const day = DateTime.fromMillis(booking.start, { zone: TIME_ZONE }).toISODate() ?? undefined;
  return {
    title: t("bookingPush.cancelTitle"),
    body: pushBody(booking, offer, locale),
    url: `/studio/week?start=${weekOf(day).start}`,
  };
}

function pushBody(booking: Booking, offer: Offer, locale: PushLocale): string {
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const offerLabel =
    offer.kind === "lesson"
      ? t("Book.lesson", { minutes: offer.minutes })
      : t("Book.rental", { minutes: offer.minutes });
  const when = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(
    new Date(booking.start),
  );
  return t("bookingPush.body", { name: booking.name, offer: offerLabel, when });
}

/** Send the push after `requestBooking()` gave `ok`. A failed push does not undo the booking: the error is logged. */
export async function sendRequestPush(db: Db, booking: Booking): Promise<void> {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, booking.offerId)).get();
    if (!offer) throw new Error(`Booking push: offer ${booking.offerId} not found`);
    await sendPush(db, (locale) => requestPush(booking, offer, locale));
  } catch (error) {
    console.error(`[booking-push] the push of booking ${booking.id} failed:`, error);
  }
}

/** Send the push after `cancelByDancer()` gave `ok`. A failed push does not undo the cancel: the error is logged. */
export async function sendCancelPush(db: Db, booking: Booking): Promise<void> {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, booking.offerId)).get();
    if (!offer) throw new Error(`Cancel push: offer ${booking.offerId} not found`);
    await sendPush(db, (locale) => cancelPush(booking, offer, locale));
  } catch (error) {
    console.error(`[booking-push] the cancel push of booking ${booking.id} failed:`, error);
  }
}
