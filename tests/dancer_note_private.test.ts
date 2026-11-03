// Nina's private note about a dancer (#697, epic #691) is shown only in the studio app: no email (the decision, the
// cancel, the reminder), no calendar file and no calendar feed of a booking whose dancer has a note contains it.
import { DateTime } from "luxon";
import { beforeEach, expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { dancerNotesFor, firstNoteLine, setDancerNote } from "../src/db/dancer-notes";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { cancelEmail, decisionEmail, reminderEmail } from "../src/lib/booking-email";
import { bookingEvent } from "../src/lib/booking-ics";
import { calendarFeed } from "../src/lib/calendar-feed";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 3_600_000;
const NOW = at("2026-11-03T12:00");
const SECRET = "SECRET-PRIVATE-NOTE-697";

let db: Db;
let offer: ReturnType<typeof addOffer>;

beforeEach(() => {
  db = openDb(":memory:");
  offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
});

function approvedBooking(start: string) {
  const begin = at(start);
  return db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: 6000,
      start: begin,
      end: begin + HOUR,
      status: "approved",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: begin - 7 * HOUR * 24,
    })
    .returning()
    .get();
}

test("the note of a dancer stays out of the emails, the calendar file and the calendar feed", async () => {
  const booking = approvedBooking("2026-11-20T14:00");
  expect(setDancerNote(db, booking, `${SECRET}\nSecond line`, NOW).ok).toBe(true);

  const emails = [
    decisionEmail(booking, offer, "approved"),
    cancelEmail(booking, offer),
    reminderEmail(booking, offer),
  ];
  for (const email of emails) {
    expect(email.text).not.toContain(SECRET);
    expect(email.html ?? "").not.toContain(SECRET);
  }
  expect(bookingEvent(booking, offer, "nl")).not.toContain(SECRET);
  expect(bookingEvent(booking, offer, "nl", true)).not.toContain(SECRET);
  expect(await calendarFeed(db, "nl", NOW)).not.toContain(SECRET);
});

test("the first line of the note shows in the studio app, cut at 80 characters with an ellipsis", () => {
  const booking = approvedBooking("2026-11-20T14:00");
  const long = `${"a".repeat(90)}\nrest`;
  setDancerNote(db, booking, long, NOW);
  const notes = dancerNotesFor(db, [booking]);
  expect(firstNoteLine(notes, booking)).toBe(`${"a".repeat(80)}…`);
  expect(firstNoteLine(notes, { email: "nobody@example.com", phone: "" })).toBeNull();
});
