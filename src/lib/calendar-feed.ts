// The iCalendar feed of the approved bookings (#103), for the calendar app on Nina's phone.
import { createEvents } from "ics";
import { createTranslator } from "next-intl";
import type { Db } from "../db";
import { listBookings } from "../db/bookings";
import type { Locale } from "../i18n/studio";
import { shownName } from "./booking-name";

const DAY = 24 * 60 * 60_000;
export const PAST_DAYS = 30;
export const NEXT_DAYS = 90;

/** The `.ics` text of the approved bookings from 30 days before `now` to 90 days after it, the times in UTC. */
export async function calendarFeed(db: Db, locale: Locale, now = Date.now()): Promise<string> {
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "StudioOffers" });
  const tWeek = createTranslator({ locale, messages, namespace: "StudioWeek" });
  const rows = listBookings(db, now - PAST_DAYS * DAY, now + NEXT_DAYS * DAY, ["approved"]);
  const { error, value } = createEvents(
    rows.map(({ booking, offer }) => ({
      uid: `booking-${booking.id}@tumach.dance`,
      start: booking.start,
      startInputType: "utc" as const,
      startOutputType: "utc" as const,
      end: booking.end,
      endInputType: "utc" as const,
      endOutputType: "utc" as const,
      title: `${t(offer.kind, { minutes: offer.minutes })}: ${shownName(booking, tWeek("removed"))}`,
      // A removed booking has no phone any more (#224): the event has no description.
      description: booking.forgottenAt === null ? booking.phone : undefined,
    })),
    { calName: "TUMACH" },
  );
  if (error || !value) throw error ?? new Error("no calendar text");
  return value;
}
