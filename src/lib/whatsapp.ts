import { parsePhoneNumberFromString } from "libphonenumber-js";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import { TIME_ZONE } from "./hours";

const MESSAGES = { en, nl } as const;

/**
 * The WhatsApp link of a dancer's phone number (#496), with `text` as the first line of the chat.
 * `null` when the number is empty (a removed dancer) or cannot be read: the page then shows no link.
 */
export function whatsappLink(phone: string, text: string): string | null {
  const number = parsePhoneNumberFromString(phone, "NL");
  if (!number?.isPossible()) return null;
  return `https://wa.me/${number.number.slice(1)}?text=${encodeURIComponent(text)}`;
}

/**
 * The WhatsApp link of a booking (#496, #497): the first line in the language of the booking (`booking.locale`),
 * with its name and its date in Europe/Amsterdam time. `null` for a removed dancer or an unreadable number.
 */
export function bookingWhatsappLink(booking: {
  phone: string;
  locale: string;
  name: string;
  start: number;
  forgottenAt: number | null;
}): string | null {
  if (booking.forgottenAt !== null) return null;
  const lang = booking.locale === "nl" ? "nl" : "en";
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  const date = new Intl.DateTimeFormat(lang, {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(booking.start);
  return whatsappLink(booking.phone, t("StudioBookings.whatsappText", { name: booking.name, date }));
}
