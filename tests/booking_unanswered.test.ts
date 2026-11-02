// The end of an unanswered request at its start, and the email to the dancer (#340).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { checkUnanswered } from "../src/lib/booking-unanswered";
import type { Email } from "../src/lib/email";

const mail = vi.hoisted(() => ({ sent: [] as Email[], fail: false }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    if (mail.fail) throw new Error("Mailgun down");
    mail.sent.push(email);
  }),
}));

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;
const MINUTE = 60_000;

let db: Db;
let offerId: number;

beforeEach(() => {
  mail.sent = [];
  mail.fail = false;
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function book(start: number, change: Partial<typeof bookings.$inferInsert> = {}) {
  return db
    .insert(bookings)
    .values({
      offerId,
      start,
      end: start + HOUR,
      status: "requested",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: start - 7 * 24 * HOUR,
      ...change,
    })
    .returning()
    .get();
}

const status = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get()?.status;

test("a request ends at its start with one email in the language of the booking", async () => {
  const start = at("2026-11-14T18:00");
  const booking = book(start);
  expect(await checkUnanswered(db, start - MINUTE)).toEqual([]);
  expect(status(booking.id)).toBe("requested");
  expect(await checkUnanswered(db, start + MINUTE)).toEqual([booking.id]);
  expect(status(booking.id)).toBe("declined");
  expect(await checkUnanswered(db, start + 6 * MINUTE)).toEqual([]);
  expect(mail.sent).toHaveLength(1);
  expect(mail.sent[0].to).toBe("ana@example.com");
  expect(mail.sent[0].text).toContain("Nina kon je aanvraag niet op tijd beantwoorden");
  expect(mail.sent[0].text).toContain("/nl/book");
});

test("an English booking gets the English email", async () => {
  const start = at("2026-11-14T18:00");
  book(start, { locale: "en" });
  await checkUnanswered(db, start + MINUTE);
  expect(mail.sent[0].text).toContain("Nina could not answer your request in time");
  expect(mail.sent[0].text).toContain("/en/book");
});

test("two checks at once send one email", async () => {
  const start = at("2026-11-14T18:00");
  book(start);
  await Promise.all([checkUnanswered(db, start + MINUTE), checkUnanswered(db, start + MINUTE)]);
  expect(mail.sent).toHaveLength(1);
});

test("a failed send keeps the request, and the next check sends it", async () => {
  const start = at("2026-11-14T18:00");
  const booking = book(start);
  mail.fail = true;
  await expect(checkUnanswered(db, start + MINUTE)).rejects.toThrow("Mailgun down");
  expect(status(booking.id)).toBe("requested");
  mail.fail = false;
  expect(await checkUnanswered(db, start + 6 * MINUTE)).toEqual([booking.id]);
  expect(mail.sent).toHaveLength(1);
});

test("an old request ends with no email; other bookings do not change", async () => {
  const now = at("2026-11-14T18:00");
  const old = book(now - 24 * HOUR - MINUTE);
  const others = (["approved", "declined", "cancelled"] as const).map((s) => book(now - HOUR, { status: s }));
  expect(await checkUnanswered(db, now)).toEqual([old.id]);
  expect(status(old.id)).toBe("declined");
  expect(mail.sent).toHaveLength(0);
  for (const [i, s] of (["approved", "declined", "cancelled"] as const).entries()) expect(status(others[i].id)).toBe(s);
});

test("a request in the night of the change of summer time ends after its start, not before", async () => {
  // 2026-10-25 02:30 exists twice (the second one is an hour later); 2027-03-28 03:00 is the first hour after the gap.
  const twice = DateTime.fromISO("2026-10-25T02:30", { zone: "Europe/Amsterdam" }).toMillis();
  for (const start of [twice, twice + HOUR, at("2027-03-28T03:00"), at("2027-03-28T01:30")]) {
    const booking = book(start);
    expect(await checkUnanswered(db, start - MINUTE)).toEqual([]);
    expect(await checkUnanswered(db, start + MINUTE)).toEqual([booking.id]);
  }
  expect(mail.sent).toHaveLength(4);
});
