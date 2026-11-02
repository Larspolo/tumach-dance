// The address of the studio in the approval email and its calendar file, from the setting STUDIO_ADDRESS (#540).
import { DateTime } from "luxon";
import { afterEach, describe, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { decisionEmail, decisionEmailHtml } from "../src/lib/booking-email";
import { bookingEvent } from "../src/lib/booking-ics";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();
const ADDRESS = "Teststraat 1, 1000 AA Amsterdam";

function booked(locale: string) {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const r = requestBooking(
    db,
    {
      offerId: offer.id,
      start: START,
      end: START + 3_600_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale,
    },
    { now: NOW },
  );
  if (!r.ok) throw new Error(r.reason);
  return { booking: { ...r.booking, status: "approved" as const }, offer };
}

afterEach(() => vi.unstubAllEnvs());

describe("the address of the studio", () => {
  test("in English and Dutch in the text and the HTML of the approval, and in the calendar file", async () => {
    vi.stubEnv("STUDIO_ADDRESS", ` ${ADDRESS} `);
    for (const [locale, word] of [
      ["en", "Where:"],
      ["nl", "Waar:"],
    ]) {
      const { booking, offer } = booked(locale);
      const mail = await decisionEmailHtml(booking, offer, "approved", "https://tumach.dance");
      expect(mail.text).toContain(`${word} ${ADDRESS}`);
      expect(mail.html).toContain(`${word} ${ADDRESS}`);
      expect(bookingEvent(booking, offer, locale)).toContain(`LOCATION:${ADDRESS.replace(",", "\\,")}`);
    }
  });

  test("no setting: no address line and no location", () => {
    vi.stubEnv("STUDIO_ADDRESS", "");
    const { booking, offer } = booked("en");
    expect(decisionEmail(booking, offer, "approved", "https://tumach.dance").text).not.toContain("Where:");
    expect(bookingEvent(booking, offer, "en")).not.toContain("LOCATION");
  });

  test("not in the declined email", () => {
    vi.stubEnv("STUDIO_ADDRESS", ADDRESS);
    const { booking, offer } = booked("en");
    expect(decisionEmail(booking, offer, "declined", "https://tumach.dance").text).not.toContain(ADDRESS);
  });
});
