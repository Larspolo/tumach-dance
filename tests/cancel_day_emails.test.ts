// Nina is sick (#709, epic #690): the cancel of a day emails each dancer with an email, once, in the language of the
// booking, with the link to book another time. Only an approved booking gets the calendar file. A dancer with no
// email gets no email.
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { cancelDay, sendCancelDayEmails } from "../src/lib/booking-cancel-day";
import type { Email } from "../src/lib/email";

const mail = vi.hoisted(() => ({ sent: [] as Email[] }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    mail.sent.push(email);
  }),
}));

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-11-18T12:00");
const DAY = "2026-11-20";

let db: Db;
let offerId: number;

beforeEach(() => {
  mail.sent = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function book(start: string, change: Partial<typeof bookings.$inferInsert>) {
  const begin = at(start);
  return db
    .insert(bookings)
    .values({
      offerId,
      priceCents: 6000,
      start: begin,
      end: begin + 60 * 60_000,
      name: "Day Dancer",
      email: "day@example.com",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      createdAt: NOW,
      ...change,
    })
    .returning()
    .get();
}

test("the cancel of a day emails each dancer once, in the booking language, with the calendar file only when approved", async () => {
  book("2026-11-20T10:00", { name: "Ana", email: "ana@example.com", locale: "en", status: "approved" });
  book("2026-11-20T12:00", { name: "Bo", email: "bo@example.com", locale: "nl", status: "requested" });
  book("2026-11-20T14:00", { name: "Eva", email: "", locale: "en", status: "approved" });

  const result = cancelDay(db, DAY, { now: NOW });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.cancelled).toHaveLength(3);

  await sendCancelDayEmails(db, result.cancelled);

  expect(mail.sent.map((email) => email.to)).toEqual(["ana@example.com", "bo@example.com"]);
  const [ana, bo] = mail.sent;

  // The language of the booking: the HTML tells it.
  expect(ana.html).toMatch(/lang="en"/);
  expect(bo.html).toMatch(/lang="nl"/);
  // The link to book another time.
  expect(ana.html).toMatch(/\/en\b/);
  expect(bo.html).toMatch(/\/nl\b/);
  // Only the approved booking removes its event from the calendar.
  expect(ana.attachments?.length ?? 0).toBe(1);
  expect(bo.attachments?.length ?? 0).toBe(0);
});

test("a day with no booking sends no email and only closes the day", async () => {
  const result = cancelDay(db, DAY, { now: NOW });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  await sendCancelDayEmails(db, result.cancelled);
  expect(mail.sent).toHaveLength(0);
});
