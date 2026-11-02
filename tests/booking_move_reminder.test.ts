// After a move (#434, epic #406): the reminder of the day before goes once, for the new time, also across the change
// of summer time; and Nina's calendar feed has the event (same UID) at the new UTC time only.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, decideBooking, moveBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { checkReminders } from "../src/lib/booking-reminder";
import { calendarFeed } from "../src/lib/calendar-feed";
import type { Email } from "../src/lib/email";

const mail = vi.hoisted(() => ({ sent: [] as Email[] }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    mail.sent.push(email);
  }),
}));

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();
const HOUR = 60 * 60_000;
const utc = (ms: number) => DateTime.fromMillis(ms, { zone: "utc" }).toFormat("yyyyMMdd'T'HHmmss'Z'");

let db: Db;
beforeEach(() => {
  mail.sent = [];
  db = openDb(":memory:");
});

function book(start: string, now: number) {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input: BookingInput = {
    offerId: offer.id,
    start: at(start),
    end: at(start) + HOUR,
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    locale: "en",
  };
  const result = requestBooking(db, input, { now });
  if (!result.ok) throw new Error(`no booking: ${result.reason}`);
  decideBooking(db, result.booking.id, "approved", null, now);
  return result.booking;
}

const cases = [
  { name: "a plain week", now: "2026-11-01T12:00", from: "2026-11-07T14:00", to: "2026-11-15T16:00" },
  {
    name: "the day after summer time starts",
    now: "2027-03-14T12:00",
    from: "2027-03-20T14:00",
    to: "2027-03-28T16:00",
  },
  { name: "the day after summer time ends", now: "2026-10-10T12:00", from: "2026-10-17T14:00", to: "2026-10-25T16:00" },
];

for (const c of cases) {
  test(`a moved booking gets one reminder for the new time, none for the old day (${c.name})`, async () => {
    const booking = book(c.from, at(c.now));
    // The reminder of the old time went already.
    const oldDue = at(c.from) - 24 * HOUR;
    expect(await checkReminders(db, oldDue + 60_000)).toEqual([booking.id]);
    mail.sent = [];
    const moved = moveBooking(db, booking.id, at(c.to), { now: oldDue + 2 * 60_000 });
    expect(moved.ok).toBe(true);
    // The old day and the time before the new due moment: nothing.
    expect(await checkReminders(db, at(c.from))).toEqual([]);
    const newDue = DateTime.fromMillis(at(c.to), { zone }).minus({ days: 1 }).toMillis();
    expect(await checkReminders(db, newDue - 60_000)).toEqual([]);
    expect(await checkReminders(db, newDue)).toEqual([booking.id]);
    expect(await checkReminders(db, newDue + 5 * 60_000)).toEqual([]);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].text).toContain("4:00 PM");
    expect(JSON.stringify(mail.sent[0])).toContain(`DTSTART:${utc(at(c.to))}`);
    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.remindedAt).toBe(newDue);
  });

  test(`the calendar feed shows the moved booking at the new UTC time only (${c.name})`, async () => {
    const now = at(c.now);
    const booking = book(c.from, now);
    const unfold = (text: string) => text.replace(/\r\n[ \t]/g, "");
    const before = unfold(await calendarFeed(db, "en", now));
    const uid = before.match(/UID:([^\r\n]+)/)?.[1];
    expect(uid).toBeTruthy();
    expect(before).toContain(`DTSTART:${utc(at(c.from))}`);
    expect(moveBooking(db, booking.id, at(c.to), { now }).ok).toBe(true);
    const after = unfold(await calendarFeed(db, "en", now));
    expect(after.match(/UID:([^\r\n]+)/g)).toEqual([`UID:${uid}`]);
    expect(after).toContain(`DTSTART:${utc(at(c.to))}`);
    expect(after).toContain(`DTEND:${utc(at(c.to) + HOUR)}`);
    expect(after).not.toContain(`DTSTART:${utc(at(c.from))}`);
  });
}
