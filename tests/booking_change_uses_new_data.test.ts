// After Nina corrects a booking, the search, the WhatsApp link, the reminder and the year file use the new data (#772, epic #758).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { changeContact, changePrice } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings, offers } from "../src/db/schema";
import { checkReminders, reminderDue } from "../src/lib/booking-reminder";
import { searchBookings } from "../src/lib/booking-search";
import type { Email } from "../src/lib/email";
import { yearCsv } from "../src/lib/money-csv";
import { bookingWhatsappLink } from "../src/lib/whatsapp";

const mail = vi.hoisted(() => ({ sent: [] as Email[] }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    mail.sent.push(email);
  }),
}));

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;
// Sunday 2026-10-25: the day that summer time ends (the change is at 03:00, the lesson at 10:00).
const START = at("2026-10-25T10:00");

let db: Db;
let offerId: number;
let bookingId: number;

beforeEach(() => {
  mail.sent = [];
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 0 }).id;
  bookingId = db
    .insert(bookings)
    .values({
      offerId,
      priceCents: 5000,
      start: START,
      end: START + HOUR,
      status: "approved",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale: "en",
      createdAt: START - 7 * 24 * HOUR,
    })
    .returning()
    .get().id;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function correct() {
  const result = changeContact(db, bookingId, {
    name: "Berta",
    email: "berta@example.org",
    phone: "+31 6 87654321",
  });
  if (!result.ok) throw new Error(result.reason);
  return result.booking;
}

test("after changeContact the search finds the booking by the new name, email and phone, not by the old ones", () => {
  correct();
  const names = (query: string) => searchBookings(db, query).map(({ booking }) => booking.name);
  expect(names("berta")).toEqual(["Berta"]);
  expect(names("berta@example.org")).toEqual(["Berta"]);
  expect(names("06 8765 4321")).toEqual(["Berta"]);
  expect(names("ana")).toEqual([]);
  expect(names("ana@example")).toEqual([]);
  expect(names("06 1234 5678")).toEqual([]);
});

test("after changeContact the WhatsApp link of the row has the digits of the new phone", () => {
  correct();
  const row = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!row) throw new Error("booking not found");
  const link = bookingWhatsappLink(row);
  expect(link).toMatch(/^https:\/\/wa\.me\/31687654321\?text=/);
  expect(link).not.toContain("31612345678");
});

test("after changeContact the reminder goes to the new address only, also across the change to winter time", async () => {
  correct();
  const due = reminderDue(START);
  expect(START - due).toBe(25 * HOUR);
  expect(await checkReminders(db, due)).toEqual([bookingId]);
  expect(mail.sent.map((m) => m.to)).toEqual(["berta@example.org"]);
});

test("after changePrice the year file has the new price and the offer keeps its price", () => {
  const labels = {
    header: ["Date", "Time", "Lesson", "Price", "Paid"] as [string, string, string, string, string],
    offer: (offer: { kind: string }) => offer.kind,
    yes: "yes",
    no: "no",
  };
  const booking = changePrice(db, bookingId, 3000);
  expect(booking?.priceCents).toBe(3000);
  expect(yearCsv(db, 2026, labels)).toContain("\r\n2026-10-25;10:00;lesson;30,00;no\r\n");
  const offer = db.select().from(offers).where(eq(offers.id, offerId)).get();
  expect(offer?.priceCents).toBe(5000);
});
