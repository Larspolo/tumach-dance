// The HTML part of the declined email (#466): the look of the site, a button to book another time, the same plain text.
// The setup is that of `email_html_all.test.ts`.
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { decisionEmail, decisionEmailHtml } from "../src/lib/booking-email";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();
const ORIGIN = "https://tumach.dance";

function booked(locale: string, name = "Ana") {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const r = requestBooking(
    db,
    {
      offerId: offer.id,
      start: START,
      end: START + 3_600_000,
      name,
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale,
    },
    { now: NOW },
  );
  if (!r.ok) throw new Error(r.reason);
  return { booking: { ...r.booking, status: "declined" as const }, offer };
}

test("the declined email has the HTML part with a book button", async () => {
  const { booking, offer } = booked("nl", "<script>x</script>");
  const mail = await decisionEmailHtml(booking, offer, "declined", ORIGIN);
  const plain = decisionEmail(booking, offer, "declined", ORIGIN);
  expect(mail.text).toBe(plain.text);
  expect(mail.subject).toBe(plain.subject);
  const html = mail.html as string;
  expect(html).toContain('lang="nl"');
  expect(html).toContain("Boek een andere tijd");
  expect(html).toContain(`href="${ORIGIN}/nl/book"`);
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
});
