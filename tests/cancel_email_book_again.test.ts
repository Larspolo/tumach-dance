// The cancel email after Nina cancelled a booking (#693, part of #690): a link to the booking page to book another time.
// A cancel by the dancer gets no such link line in the plain text.
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { cancelEmail, cancelEmailHtml } from "../src/lib/booking-email";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const ORIGIN = "https://tumach.dance";

function booked(locale: string) {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const start = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();
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

describe("cancel email: book another time after a cancel by Nina (#693)", () => {
  test("English, cancel by Nina: a link line to the English booking page", () => {
    const { booking, offer } = booked("en");
    const email = cancelEmail(booking, offer, "nina", false, ORIGIN);
    expect(email.text).toContain("Book another time: https://tumach.dance/en/book");
  });

  test("Dutch, cancel by Nina: a link line to the Dutch booking page", () => {
    const { booking, offer } = booked("nl");
    const email = cancelEmail(booking, offer, "nina", false, ORIGIN);
    expect(email.text).toContain("Boek een andere tijd: https://tumach.dance/nl/book");
    expect(email.text).not.toContain("/en/book");
  });

  test("cancel by Nina, HTML: the button to the booking page in English", async () => {
    const { booking, offer } = booked("en");
    const email = await cancelEmailHtml(booking, offer, "nina", false, ORIGIN);
    expect(email.html).toContain("Book another time");
    expect(email.html).toContain("https://tumach.dance/en/book");
  });

  test("cancel by Nina, HTML: the button to the booking page in Dutch", async () => {
    const { booking, offer } = booked("nl");
    const email = await cancelEmailHtml(booking, offer, "nina", false, ORIGIN);
    expect(email.html).toContain("Boek een andere tijd");
    expect(email.html).toContain("https://tumach.dance/nl/book");
  });

  test("cancel by the dancer: no book-again link line in the plain text, in English or Dutch", () => {
    for (const locale of ["en", "nl"]) {
      const { booking, offer } = booked(locale);
      const email = cancelEmail(booking, offer, "dancer", false, ORIGIN);
      expect(email.text).not.toContain("/book");
      expect(email.text).not.toContain("Book another time");
      expect(email.text).not.toContain("Boek een andere tijd");
    }
  });
});
