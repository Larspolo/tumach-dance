// The emails to a dancer carry Nina's address as Reply-To (#375), so a Reply in Gmail reaches her. No STUDIO_EMAIL: no
// Reply-To. The login code and the contact email keep their own values (tests/contact_email.test.ts).
import { DateTime } from "luxon";
import { afterEach, describe, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import {
  cancelEmail,
  decisionEmail,
  paymentReminderEmail,
  reminderEmail,
  requestEmail,
  unansweredEmail,
} from "../src/lib/booking-email";
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Reply-To of the emails to a dancer", () => {
  test("with STUDIO_EMAIL: each of the six emails replies to Nina", () => {
    vi.stubEnv("STUDIO_EMAIL", "nina@example.test");
    const { booking, offer } = booked("en", "2026-10-25");
    const emails = [
      requestEmail(booking, offer, "en"),
      decisionEmail(booking, offer, "approved"),
      cancelEmail(booking, offer),
      unansweredEmail(booking, offer),
      reminderEmail(booking, offer),
      paymentReminderEmail(booking, offer),
    ];
    for (const email of emails) {
      expect(email.to).toBe("ana@example.com");
      expect(email.replyTo).toBe("nina@example.test");
    }
  });

  test("without STUDIO_EMAIL: no Reply-To", () => {
    vi.stubEnv("STUDIO_EMAIL", "");
    const { booking, offer } = booked("en", "2026-10-25");
    const emails = [
      requestEmail(booking, offer, "en"),
      decisionEmail(booking, offer, "declined"),
      cancelEmail(booking, offer),
      unansweredEmail(booking, offer),
      reminderEmail(booking, offer),
      paymentReminderEmail(booking, offer),
    ];
    for (const email of emails) {
      expect(email).not.toHaveProperty("replyTo");
    }
  });
});
