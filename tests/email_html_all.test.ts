// The HTML part of the other emails to a dancer (#440): each link of the plain text is a button, the plain text stays
// the same, and a name is escaped. The setup is that of `email_html.test.ts` (#439).
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import {
  cancelEmail,
  cancelEmailHtml,
  moveEmail,
  moveEmailHtml,
  paymentReminderEmail,
  paymentReminderEmailHtml,
  reminderEmail,
  reminderEmailHtml,
  requestEmail,
  requestEmailHtml,
  unansweredEmail,
  unansweredEmailHtml,
} from "../src/lib/booking-email";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();
const TIKKIE = "https://tikkie.me/pay/abc";
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
  return { booking: { ...r.booking, status: "approved" as const, tikkieUrl: TIKKIE }, offer };
}

const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
const linksIn = (text: string) => text.match(/https?:\/\/\S+/g) ?? [];

/** The six builders with their HTML part, each with the plain builder it must match. */
function cases(booking: ReturnType<typeof booked>["booking"], offer: ReturnType<typeof booked>["offer"]) {
  const from = { start: START - 86_400_000 };
  return [
    {
      name: "request",
      plain: requestEmail(booking, offer, "en", ORIGIN),
      html: () => requestEmailHtml(booking, offer, "en", ORIGIN),
    },
    {
      name: "cancel",
      plain: cancelEmail(booking, offer, "nina", false, ORIGIN),
      html: () => cancelEmailHtml(booking, offer, "nina", false, ORIGIN),
    },
    {
      name: "move",
      plain: moveEmail(booking, offer, from, ORIGIN),
      html: () => moveEmailHtml(booking, offer, from, ORIGIN),
    },
    {
      name: "unanswered",
      plain: unansweredEmail(booking, offer, ORIGIN),
      html: () => unansweredEmailHtml(booking, offer, ORIGIN),
    },
    {
      name: "reminder",
      plain: reminderEmail(booking, offer, ORIGIN),
      html: () => reminderEmailHtml(booking, offer, ORIGIN),
    },
    {
      name: "payment reminder",
      plain: paymentReminderEmail(booking, offer),
      html: () => paymentReminderEmailHtml(booking, offer),
    },
  ];
}

describe("the HTML part of the other booking emails", () => {
  const { booking, offer } = booked("en");

  for (const c of cases(booking, offer)) {
    test(`${c.name}: each link of the text is a button; the text is the same`, async () => {
      const mail = await c.html();
      expect(mail.text).toBe(c.plain.text);
      expect(mail.subject).toBe(c.plain.subject);
      const html = mail.html as string;
      expect(html).toContain("color-scheme");
      const links = hrefs(html);
      for (const link of linksIn(mail.text)) expect(links).toContain(link);
      expect(links.length).toBeGreaterThan(0);
    });
  }

  test("the cancel link of the plain text is the cancel button; the payment button has the Tikkie link", async () => {
    const request = await requestEmailHtml(booking, offer, "en", ORIGIN);
    expect(hrefs(request.html as string).some((h) => h.startsWith(`${ORIGIN}/en/booking/cancel`))).toBe(true);
    const payment = await paymentReminderEmailHtml(booking, offer);
    expect(hrefs(payment.html as string)).toContain(TIKKIE);
    const noTikkie = await paymentReminderEmailHtml({ ...booking, tikkieUrl: null }, offer);
    expect(hrefs(noTikkie.html as string)).not.toContain(TIKKIE);
    expect(noTikkie.text).toBe(paymentReminderEmail({ ...booking, tikkieUrl: null }, offer).text);
  });
});

describe("a name is escaped in each HTML part", () => {
  const { booking, offer } = booked("en", "<script>x</script>");
  for (const c of cases(booking, offer)) {
    test(c.name, async () => {
      const html = (await c.html()).html as string;
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    });
  }
});
