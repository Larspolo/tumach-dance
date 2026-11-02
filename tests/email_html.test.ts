// The HTML part of the approval email (#439): the look of the site, a pay and a cancel button, the escaped name, and
// the Mailgun field `html`.
import { DateTime } from "luxon";
import { afterEach, describe, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { decisionEmail, decisionEmailHtml } from "../src/lib/booking-email";
import { sendEmail } from "../src/lib/email";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();
const TIKKIE = "https://tikkie.me/pay/abc";

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

const buttons = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];

describe("the approval email in HTML", () => {
  test("greeting, time, the Tikkie and the cancel button; the text stays plain", async () => {
    const { booking, offer } = booked("en");
    const mail = await decisionEmailHtml(booking, offer, "approved", "https://tumach.dance");
    expect(mail.text).toBe(decisionEmail(booking, offer, "approved", "https://tumach.dance").text);
    const html = mail.html as string;
    expect(html).toContain("Hi Ana,");
    expect(html).toContain("Sunday, October 25, 2026 at 10:00");
    const links = buttons(html);
    expect(links.map((m) => m[1])).toContain(TIKKIE);
    expect(links.some((m) => m[1].startsWith("https://tumach.dance/en/booking/cancel"))).toBe(true);
    expect(html).toContain("Pay with Tikkie");
    expect(html).toContain("Cancel the booking</");
    expect(html).toContain("color-scheme");
    expect(mail.text).not.toContain("<");
    expect(mail.text).toContain(`Please pay with this Tikkie: ${TIKKIE}`);
    expect(mail.text.startsWith("Hi Ana,\n\nNina approved your request")).toBe(true);
    for (const m of links) expect(m[0]).toMatch(/min-height:44px/);
  });

  test("Dutch labels; no Tikkie link: no pay button", async () => {
    const { booking, offer } = booked("nl");
    const html = (await decisionEmailHtml({ ...booking, tikkieUrl: null }, offer, "approved")).html as string;
    expect(html).toContain("Annuleer de boeking");
    expect(html).not.toContain("Betaal met Tikkie");
    expect(html).toContain('lang="nl"');
  });

  test("the name is escaped; the declined email has no HTML", async () => {
    const { booking, offer } = booked("en", "<script>x</script>");
    const html = (await decisionEmailHtml(booking, offer, "approved")).html as string;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect((await decisionEmailHtml(booking, offer, "declined")).html).toBeUndefined();
  });
});

describe("sendEmail with html", () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = { MAILGUN_API_KEY: "k", MAILGUN_DOMAIN: "tumach.dance", NODE_ENV: "test" } as NodeJS.ProcessEnv;

  test("the field html, also in the multipart form of an attachment", async () => {
    const stub = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", stub);
    const base = { to: "a@b.nl", subject: "s", text: "t", html: "<p>h</p>" };
    await sendEmail(base, env);
    await sendEmail({ ...base, attachments: [{ filename: "a.ics", contentType: "text/calendar", content: "x" }] }, env);
    const bodies = stub.mock.calls.map((c) => (c as unknown as [string, RequestInit])[1].body);
    expect((bodies[0] as URLSearchParams).get("html")).toBe("<p>h</p>");
    expect((bodies[1] as FormData).get("html")).toBe("<p>h</p>");
    await sendEmail({ to: "a@b.nl", subject: "s", text: "t" }, env);
    expect(((stub.mock.calls[2] as unknown as [string, RequestInit])[1].body as URLSearchParams).has("html")).toBe(
      false,
    );
  });
});
