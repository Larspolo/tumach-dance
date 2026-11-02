// The calendar file of one booking (#166): the reminder email attaches it, so that the dancer adds it with one tap.
// The location is the address of the studio (`STUDIO_ADDRESS`, #540); with no setting the event has none.
import { createEvents } from "ics";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Booking } from "../db/bookings";
import type { Offer } from "../db/offers";
import { studioAddress } from "./studio-email";

const MESSAGES = { en, nl } as const;

/**
 * The `.ics` text of `booking` with the title "TUMACH: <offer>" in `locale` (English for another one), times in UTC.
 * `cancel` (#386): the file that removes the event from the calendar of the dancer (iTIP CANCEL, RFC 5546): the same
 * uid with a higher sequence than the approval and the reminder (`calendarSequence`, one more at each move, #409).
 */
export function bookingEvent(booking: Booking, offer: Offer, locale: string, cancel = false): string {
  const lang = locale in MESSAGES ? (locale as keyof typeof MESSAGES) : "en";
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  const label =
    offer.kind === "lesson"
      ? t("Book.lesson", { minutes: offer.minutes })
      : t("Book.rental", { minutes: offer.minutes });
  // A move adds one to `calendarSequence` (#409): the cancel file is always higher than the last file of the dancer.
  const sequence = booking.calendarSequence ?? 0;
  const cancelFields = cancel ? { status: "CANCELLED" as const, sequence: sequence + 1 } : { sequence };
  const { error, value } = createEvents(
    [
      {
        ...cancelFields,
        uid: `booking-${booking.id}@tumach.dance`,
        start: booking.start,
        startInputType: "utc",
        startOutputType: "utc",
        end: booking.end,
        endInputType: "utc",
        endOutputType: "utc",
        title: `TUMACH: ${label}`,
        ...(studioAddress() ? { location: studioAddress() } : {}),
      },
    ],
    cancel ? { method: "CANCEL" } : undefined,
  );
  if (error || !value) throw error ?? new Error("no calendar text");
  return value;
}
