// The "Book another lesson" link (#726, epic #722) in the approval and reminder emails, text and HTML, in English and Dutch.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer, type Offer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { againUrl } from "../src/lib/booking-again";
import {
  cancelEmail,
  cancelEmailHtml,
  decisionEmail,
  decisionEmailHtml,
  moveEmail,
  moveEmailHtml,
  paymentReminderEmail,
  reminderEmail,
  reminderEmailHtml,
  requestEmail,
} from "../src/lib/booking-email";
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

/** The link of the booking: the address of the booking page with the token of the booking. */
function linkOf(locale: string, token: string): string {
  return againUrl(ORIGIN, { locale, cancelToken: token });
}

describe.each(["en", "nl"])("the book-again link in the %s emails", (locale) => {
  test("the approval email has the link in the text and in the HTML", async () => {
    const booking = book(locale, { status: "approved" });
    const link = linkOf(locale, booking.cancelToken);
    const text = decisionEmail(booking, offer, "approved", ORIGIN);
    const html = await decisionEmailHtml(booking, offer, "approved", ORIGIN);
    expect(text.text).toContain(link);
    expect(html.html).toContain(link);
    expect(html.html).toContain(locale === "en" ? "Book another lesson" : "Boek nog een les");
  });

  test("the reminder email has the link in the text and in the HTML", async () => {
    const booking = book(locale, { status: "approved" });
    const link = linkOf(locale, booking.cancelToken);
    const text = reminderEmail(booking, offer, ORIGIN);
    const html = await reminderEmailHtml(booking, offer, ORIGIN);
    expect(text.text).toContain(link);
    expect(html.html).toContain(link);
    expect(html.html).toContain(locale === "en" ? "Book another lesson" : "Boek nog een les");
  });

  test("the other emails have no book-again link", async () => {
    const booking = book(locale, { status: "approved" });
    const link = linkOf(locale, booking.cancelToken);
    const others: Email[] = [
      requestEmail(booking, offer, locale, ORIGIN),
      cancelEmail(booking, offer, "nina", true, ORIGIN),
      cancelEmail(booking, offer, "dancer", true, ORIGIN),
      moveEmail(booking, offer, { start: booking.start - 24 * HOUR }, ORIGIN),
      paymentReminderEmail(booking, offer),
    ];
    for (const email of others) {
      expect(email.text).not.toContain(link);
      expect(email.text).not.toContain("?again=");
    }
    const htmls = [
      await cancelEmailHtml(booking, offer, "nina", true, ORIGIN),
      await moveEmailHtml(booking, offer, { start: booking.start - 24 * HOUR }, ORIGIN),
    ];
    for (const email of htmls) {
      expect(email.html).not.toContain(link);
      expect(email.html).not.toContain("?again=");
    }
  });
});

test("the link carries only the token and the locale, not the personal data", () => {
  const booking = db
    .select()
    .from(bookings)
    .where(eq(bookings.id, book("nl").id))
    .get();
  const link = linkOf("nl", booking?.cancelToken ?? "");
  expect(link).toBe(`${ORIGIN}/nl/book?again=${booking?.cancelToken}`);
  expect(link).not.toContain("Ana");
  expect(link).not.toContain("ana@example.com");
});
