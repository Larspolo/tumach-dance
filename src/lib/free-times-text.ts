// The text of the free times of one offer for the next 7 days, which Nina can send to a dancer (#727, epic #723).
import { DateTime } from "luxon";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json" with { type: "json" };
import nl from "../../messages/nl.json" with { type: "json" };
import type { Db } from "../db";
import type { Offer } from "../db/offers";
import { withFallback } from "../i18n/fallback";
import { bookingDays } from "./booking-page";
import { TIME_ZONE } from "./hours";
import { offerLabel } from "./offer-label";

export const SHARE_DAYS = 7;
export type ShareLocale = "en" | "nl";
const MESSAGES = { en, nl: withFallback(nl, en) };

/** The free times of the next 7 days (the slots of the booking page), per day, and the link to the booking page. */
export function freeTimesText(
  db: Db,
  offer: Offer,
  locale: ShareLocale,
  origin: string,
  now: number = Date.now(),
): string {
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const label = offerLabel((key, values) => t(`Book.${key}`, values), locale, offer);
  const dayName = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const lines = bookingDays(db, offer, now)
    .slice(0, SHARE_DAYS)
    .filter((d) => d.slots.length > 0)
    .map((d) => {
      const name = dayName.format(new Date(`${d.date}T12:00:00Z`));
      const times = d.slots.map((s) => DateTime.fromMillis(s.start, { zone: TIME_ZONE }).toFormat("HH:mm"));
      return `${name}: ${times.join(", ")}`;
    });
  const link = `${origin}/${locale}/book?offer=${offer.id}`;
  const body = lines.length > 0 ? [t("StudioShare.free"), ...lines] : [t("StudioShare.none")];
  return [label, ...body, t("StudioShare.link", { link })].join("\n");
}
