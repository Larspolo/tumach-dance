// The email to the dancer after Nina cancelled a booking (#160): the language of the booking, the Amsterdam time in
// summer and in winter time, and the goodbye that points to the booking page.
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { cancelEmail } from "../src/lib/booking-email";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();

function booked(locale: string, day: string) {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const start = DateTime.fromISO(`${day}T10:00`, { zone }).toMillis();
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start,
      end: start + 60 * 60_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale,
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`the booking should be ok: ${result.reason}`);
  return { booking: result.booking, offer };
}

describe("cancelEmail", () => {
  test("English: the offer, the Amsterdam time and the booking page", () => {
    const { booking, offer } = booked("en", "2026-10-25");
    const email = cancelEmail(booking, offer);
    expect(email.to).toBe("ana@example.com");
    expect(email.subject).toBe("Your booking at TUMACH is cancelled");
    expect(email.text).toContain("Hi Ana,");
    expect(email.text).toContain(
      "Nina cancelled your booking: Private lesson, 60 min, Sunday, October 25, 2026 at 10:00 AM.",
    );
    expect(email.text).toContain("You can pick another time on the booking page.");
  });

  test("winter time: 10:00 in Amsterdam stays 10:00 after summer time ends", () => {
    const { booking, offer } = booked("en", "2026-11-01");
    expect(cancelEmail(booking, offer).text).toContain("Sunday, November 1, 2026 at 10:00 AM.");
  });

  test("Dutch booking: the Dutch subject and text", () => {
    const { booking, offer } = booked("nl", "2026-10-25");
    const email = cancelEmail(booking, offer);
    expect(email.subject).toBe("Je boeking bij TUMACH is geannuleerd");
    expect(email.text).toContain("Hoi Ana,");
    expect(email.text).toContain("Nina heeft je boeking geannuleerd: ");
  });
});
