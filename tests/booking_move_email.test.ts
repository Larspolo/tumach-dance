// The email to the dancer after Nina moved a booking (#410): the old and the new time in Amsterdam time, the cancel
// link, one calendar file with the new start and the next sequence for an approved booking, none for a request, and
// a failed send does not throw.
import { DateTime } from "luxon";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { decideBooking, moveBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { offers as offersTable } from "../src/db/schema";
import { moveEmail, sendMoveEmail } from "../src/lib/booking-email";
import { saveHoursRule } from "../src/lib/hours-store";

const mail = vi.hoisted(() => ({ fail: false, sent: [] as unknown[] }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: unknown) => {
    if (mail.fail) throw new Error("Mailgun down");
    mail.sent.push(email);
  }),
}));

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const HOUR = 60 * 60_000;

let db: Db;
let offerId: number;

beforeEach(() => {
  mail.fail = false;
  mail.sent = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "17:00" } } });
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function at(local: string): number {
  return DateTime.fromISO(local, { zone }).toMillis();
}

/** A booking on Sunday 25 October at 10:00 (summer time), in `locale`, requested or approved. */
function booked(locale: string, approved: boolean) {
  const start = at("2026-10-25T10:00");
  const result = requestBooking(
    db,
    { offerId, start, end: start + HOUR, name: "Ana", email: "ana@example.com", phone: "+31 6 12345678", locale },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`the booking should be ok: ${result.reason}`);
  if (!approved) return { booking: result.booking, from: { start, end: start + HOUR } };
  const decided = decideBooking(db, result.booking.id, "approved", null, NOW);
  if (!decided.ok) throw new Error(`the approval should be ok: ${decided.reason}`);
  return { booking: decided.booking, from: { start, end: start + HOUR } };
}

/** Move the booking to Sunday 1 November at 14:00 (winter time) and return the moved booking and its old time. */
function moved(locale: string, approved: boolean) {
  const { booking, from } = booked(locale, approved);
  const result = moveBooking(db, booking.id, at("2026-11-01T14:00"), { now: NOW });
  if (!result.ok) throw new Error(`the move should be ok: ${result.reason}`);
  return { booking: result.booking, from };
}

function offer() {
  return db.select().from(offersTable).get() as Parameters<typeof moveEmail>[1];
}

describe("moveEmail", () => {
  test("English: the subject, the old and the new time in Amsterdam time, and the cancel link", () => {
    const { booking, from } = moved("en", false);
    const email = moveEmail(booking, offer(), from, "https://tumach.dance");
    expect(email.to).toBe("ana@example.com");
    expect(email.subject).toBe("Your booking at TUMACH has a new time");
    expect(email.text).toContain("Hi Ana,");
    expect(email.text).toContain(
      "Nina moved your booking: Private lesson, 60 min. It was Sunday, October 25, 2026 at 10:00 AM. The new time is Sunday, November 1, 2026 at 2:00 PM.",
    );
    expect(email.text).toContain("Move or cancel the booking with this link");
    expect(email.text).toMatch(/https:\/\/tumach\.dance\/en\/booking\/cancel\S+/);
  });

  test("Dutch booking: the Dutch subject and the old and the new time", () => {
    const { booking, from } = moved("nl", false);
    const email = moveEmail(booking, offer(), from, "https://tumach.dance");
    expect(email.subject).toBe("Je boeking bij TUMACH heeft een nieuwe tijd");
    expect(email.text).toContain("Hoi Ana,");
    expect(email.text).toContain("Nina heeft je boeking verplaatst: ");
    expect(email.text).toContain("Het was zondag 25 oktober 2026");
    expect(email.text).toContain("De nieuwe tijd is zondag 1 november 2026");
  });

  test("an approved booking has one .ics with the new start and the next sequence", () => {
    const { booking, from } = moved("en", true);
    const email = moveEmail(booking, offer(), from);
    expect(email.attachments).toHaveLength(1);
    const ics = email.attachments?.[0].content as string;
    expect(ics).toContain("SEQUENCE:1");
    expect(ics).toContain(
      `DTSTART:${DateTime.fromMillis(at("2026-11-01T14:00")).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`,
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  test("a requested booking has no calendar file", () => {
    const { booking, from } = moved("en", false);
    expect(moveEmail(booking, offer(), from).attachments).toBeUndefined();
  });
});

describe("sendMoveEmail", () => {
  test("sends the move email", async () => {
    const { booking, from } = moved("en", false);
    await sendMoveEmail(db, booking, from);
    expect(mail.sent).toHaveLength(1);
  });

  test("a failed send does not throw", async () => {
    const { booking, from } = moved("en", true);
    mail.fail = true;
    await expect(sendMoveEmail(db, booking, from)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
