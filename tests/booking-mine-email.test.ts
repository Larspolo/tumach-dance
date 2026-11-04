// The link to the next bookings of the dancer (#744, after #743) in the emails of a booking, text and HTML, in English
// and Dutch. The cancel and the declined emails have no such link.
import { DateTime } from "luxon";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer, type Offer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import {
  cancelEmail,
  cancelEmailHtml,
  decisionEmail,
  decisionEmailHtml,
  moveEmail,
  moveEmailHtml,
  reminderEmail,
  reminderEmailHtml,
  repeatEmail,
  requestEmail,
  requestEmailHtml,
} from "../src/lib/booking-email";
import { mineUrl } from "../src/lib/booking-mine";
import type { Email } from "../src/lib/email";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn(async () => {}) }));

const ORIGIN = "https://tumach.test";
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;

let db: Db;
let offer: Offer;

beforeEach(() => {
  db = openDb(":memory:");
  offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
});

function book(locale: string, change: Partial<typeof bookings.$inferInsert> = {}) {
  const start = at("2026-11-14T18:00");
  return db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: 6000,
      start,
      end: start + HOUR,
      status: "approved",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale,
      createdAt: start - 7 * 24 * HOUR,
      ...change,
    })
    .returning()
    .get();
}

describe.each(["en", "nl"])("the next-bookings link in the %s emails", (locale) => {
  const label = locale === "en" ? "See your bookings" : "Bekijk je boekingen";

  test("the request email has the link in the text and in the HTML", async () => {
    const booking = book(locale, { status: "requested" });
    const link = mineUrl(ORIGIN, booking);
    const text = requestEmail(booking, offer, locale, ORIGIN);
    const html = await requestEmailHtml(booking, offer, locale, ORIGIN);
    expect(text.text).toContain(link);
    expect(html.html).toContain(link);
    expect(html.html).toContain(label);
  });

  test("the approval email has the link in the text and in the HTML", async () => {
    const booking = book(locale, { status: "approved" });
    const link = mineUrl(ORIGIN, booking);
    const text = decisionEmail(booking, offer, "approved", ORIGIN);
    const html = await decisionEmailHtml(booking, offer, "approved", ORIGIN);
    expect(text.text).toContain(link);
    expect(html.html).toContain(link);
    expect(html.html).toContain(label);
  });

  test("the move email has the link in the text and in the HTML", async () => {
    const booking = book(locale, { status: "approved" });
    const link = mineUrl(ORIGIN, booking);
    const from = { start: at("2026-11-07T18:00") };
    const text = moveEmail(booking, offer, from, ORIGIN);
    const html = await moveEmailHtml(booking, offer, from, ORIGIN);
    expect(text.text).toContain(link);
    expect(html.html).toContain(link);
    expect(html.html).toContain(label);
  });

  test("the reminder email has the link in the text and in the HTML", async () => {
    const booking = book(locale, { status: "approved" });
    const link = mineUrl(ORIGIN, booking);
    const text = reminderEmail(booking, offer, ORIGIN);
    const html = await reminderEmailHtml(booking, offer, ORIGIN);
    expect(text.text).toContain(link);
    expect(html.html).toContain(link);
    expect(html.html).toContain(label);
  });

  test("the repeat email has one link, for the token of the first booking", () => {
    const first = book(locale, { status: "approved" });
    const second = book(locale, { status: "approved", start: at("2026-11-21T18:00"), end: at("2026-11-21T19:00") });
    const text = repeatEmail([first, second], offer, ORIGIN);
    expect(text.text).toContain(mineUrl(ORIGIN, first));
    expect(text.text.split(mineUrl(ORIGIN, first)).length - 1).toBe(1);
  });

  test("the cancel and the declined emails have no next-bookings link", async () => {
    const booking = book(locale, { status: "approved" });
    const link = mineUrl(ORIGIN, booking);
    const others: Email[] = [
      cancelEmail(booking, offer, "dancer", true, ORIGIN),
      cancelEmail(booking, offer, "nina", true, ORIGIN),
      decisionEmail(booking, offer, "declined", ORIGIN),
      await cancelEmailHtml(booking, offer, "dancer", true, ORIGIN),
      await decisionEmailHtml(booking, offer, "declined", ORIGIN),
    ];
    for (const email of others) {
      expect(email.text ?? "").not.toContain(link);
      expect(email.html ?? "").not.toContain("/booking/mine");
    }
  });
});
