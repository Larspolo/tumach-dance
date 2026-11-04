// The emails show the price that the booking keeps (`booking.priceCents`), not the price its offer has now (#757).
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import {
  decisionEmail,
  decisionEmailHtml,
  paymentReminderEmail,
  paymentReminderEmailHtml,
} from "../src/lib/booking-email";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();

/** A booking that kept 50 euro, whose offer now costs 60 euro. */
function changedPrice(locale: string) {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 0 });
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: START,
      end: START + 60 * 60_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale,
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`the booking should be ok: ${result.reason}`);
  const booking = { ...result.booking, priceCents: 5000 };
  const changed = { ...offer, priceCents: 6000 };
  return { booking, offer: changed };
}

const EN_50 = /€50\.00/;
const NL_50 = /€\s50,00/;
const EN_60 = /€60\.00/;
const NL_60 = /€\s60,00/;

describe("the price in the emails is the price of the booking", () => {
  test.each([
    ["en", EN_50, EN_60],
    ["nl", NL_50, NL_60],
  ])("%s: the approval email text shows the booked price", (locale, shown, other) => {
    const { booking, offer } = changedPrice(locale);
    const mail = decisionEmail(booking, offer, "approved");
    expect(mail.text).toMatch(shown);
    expect(mail.text).not.toMatch(other);
  });

  test.each([
    ["en", EN_50, EN_60],
    ["nl", NL_50, NL_60],
  ])("%s: the approval email HTML shows the booked price", async (locale, shown, other) => {
    const { booking, offer } = changedPrice(locale);
    const mail = await decisionEmailHtml(booking, offer, "approved", "https://tumach.dance");
    expect(mail.html).toMatch(shown);
    expect(mail.html).not.toMatch(other);
  });

  test.each([
    ["en", EN_50, EN_60],
    ["nl", NL_50, NL_60],
  ])("%s: the payment reminder text shows the booked price", (locale, shown, other) => {
    const { booking, offer } = changedPrice(locale);
    const mail = paymentReminderEmail(booking, offer);
    expect(mail.text).toMatch(shown);
    expect(mail.text).not.toMatch(other);
  });

  test.each([
    ["en", EN_50, EN_60],
    ["nl", NL_50, NL_60],
  ])("%s: the payment reminder HTML shows the booked price", async (locale, shown, other) => {
    const { booking, offer } = changedPrice(locale);
    const mail = await paymentReminderEmailHtml(booking, offer);
    expect(mail.html).toMatch(shown);
    expect(mail.html).not.toMatch(other);
  });
});
