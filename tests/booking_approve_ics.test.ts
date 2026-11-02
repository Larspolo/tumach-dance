// The approval email has the calendar file of the booking (#385), with the same uid as the reminder, in UTC,
// on the days of the change to and from summer time. A declined booking has no file.
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import type { Booking } from "../src/db/bookings";
import type { Offer } from "../src/db/offers";
import { decisionEmail, reminderEmail } from "../src/lib/booking-email";

const zone = "Europe/Amsterdam";
const offer = { id: 1, kind: "lesson", minutes: 60, priceCents: 6000, position: 0 } as unknown as Offer;

function bookingAt(id: number, local: string): Booking {
  const start = DateTime.fromISO(local, { zone }).toMillis();
  return {
    id,
    offerId: 1,
    start,
    end: start + 60 * 60_000,
    name: "Ana",
    email: "ana@example.com",
    phone: "+31600000000",
    locale: "en",
    status: "approved",
    tikkieUrl: null,
  } as unknown as Booking;
}

describe("the approval email has the calendar file", () => {
  // 2026-10-25: summer time ends. 10:00 CET is 09:00 UTC.
  test("approved: one tumach.ics with the uid and the times in UTC, after the change from summer time", () => {
    const booking = bookingAt(12, "2026-10-25T10:00");
    const email = decisionEmail(booking, offer, "approved");
    expect(email.attachments).toHaveLength(1);
    const [file] = email.attachments ?? [];
    expect(file.filename).toBe("tumach.ics");
    expect(file.contentType).toBe("text/calendar");
    expect(file.content).toContain("UID:booking-12@tumach.dance");
    expect(file.content).toContain("DTSTART:20261025T090000Z");
    expect(file.content).toContain("DTEND:20261025T100000Z");
  });

  // 2027-03-28: summer time starts. 10:00 CEST is 08:00 UTC.
  test("approved: the times in UTC in the week of the change to summer time", () => {
    const booking = bookingAt(13, "2027-03-28T10:00");
    const [file] = decisionEmail(booking, offer, "approved").attachments ?? [];
    expect(file.content).toContain("UID:booking-13@tumach.dance");
    expect(file.content).toContain("DTSTART:20270328T080000Z");
    expect(file.content).toContain("DTEND:20270328T090000Z");
  });

  test("the approval and the reminder of a booking have the same uid: one event", () => {
    const booking = bookingAt(14, "2027-03-28T10:00");
    const [approvedFile] = decisionEmail(booking, offer, "approved").attachments ?? [];
    const [reminderFile] = reminderEmail(booking, offer).attachments ?? [];
    const uid = (text: string) => text.match(/UID:[^\r\n]+/)?.[0];
    expect(uid(approvedFile.content)).toBe(uid(reminderFile.content));
    expect(uid(approvedFile.content)).toBe("UID:booking-14@tumach.dance");
  });

  test("declined: no attachment", () => {
    const booking = bookingAt(15, "2026-10-25T10:00");
    const email = decisionEmail(booking, offer, "declined");
    expect(email.attachments).toBeUndefined();
  });
});
