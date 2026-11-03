// Each email of the site ends with the signature "Nina", not "TUMACH" (Nina's wish on #561, #788).
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { requestEmail } from "../src/lib/booking-email";
import { answerEmail, type ContactMessage } from "../src/lib/contact-store";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();

function booked() {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: START,
      end: START + 3_600_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale: "nl",
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(result.reason);
  return { booking: result.booking, offer };
}

function message(locale: string): ContactMessage {
  return {
    id: 1,
    name: "Ana",
    email: "ana@example.com",
    message: "Hello",
    locale,
    createdAt: NOW,
    answer: null,
    answeredAt: null,
  };
}

describe.each(["en", "nl"])("the signature in %s", (locale) => {
  test("the booking email ends with Nina", () => {
    const { booking, offer } = booked();
    const email = requestEmail(booking, offer, locale);
    expect(email.text.trimEnd().split("\n").at(-1)).toBe("Nina");
    expect(email.text).not.toMatch(/\nTUMACH\s*$/);
  });

  test("the contact answer is signed Nina in the text and the HTML", async () => {
    const email = await answerEmail(message(locale), "Thank you!");
    expect(email.text).toContain("\n\nNina\n\n---");
    expect(email.html).toContain(">Nina<");
  });
});
