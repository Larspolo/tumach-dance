// The cancel email of an approved booking has the cancel file (#386): the same uid as the approval, METHOD:CANCEL,
// STATUS:CANCELLED and a higher SEQUENCE. A booking that was not approved gets no file.
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import type { Booking } from "../src/db/bookings";
import type { Offer } from "../src/db/offers";
import { cancelEmail, decisionEmail } from "../src/lib/booking-email";
import { bookingEvent } from "../src/lib/booking-ics";

const zone = "Europe/Amsterdam";
// 2026-10-25: summer time ends. 10:00 CET is 09:00 UTC.
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();
const offer = { id: 1, kind: "lesson", minutes: 60, priceCents: 6000, position: 0 } as unknown as Offer;
const booking = {
  id: 21,
  offerId: 1,
  start: START,
  end: START + 60 * 60_000,
  name: "Ana",
  email: "ana@example.com",
  phone: "+31600000000",
  locale: "en",
  status: "cancelled",
  tikkieUrl: null,
} as unknown as Booking;

function cancelFile(by: "nina" | "dancer") {
  const [file] = cancelEmail(booking, offer, by, true).attachments ?? [];
  return file;
}

describe("the cancel email of an approved booking has the cancel file", () => {
  for (const by of ["nina", "dancer"] as const) {
    test(`cancelled by ${by}: METHOD CANCEL, STATUS CANCELLED, the same uid, a higher sequence`, () => {
      const email = cancelEmail(booking, offer, by, true);
      expect(email.attachments).toHaveLength(1);
      const file = cancelFile(by);
      expect(file.filename).toBe("tumach.ics");
      expect(file.contentType).toBe("text/calendar");
      expect(file.content).toContain("METHOD:CANCEL");
      expect(file.content).toContain("STATUS:CANCELLED");
      expect(file.content).toContain("UID:booking-21@tumach.dance");
      expect(file.content).toContain("DTSTART:20261025T090000Z");
      expect(file.content).toContain("DTEND:20261025T100000Z");

      const approval = bookingEvent({ ...booking, status: "approved" } as Booking, offer, "en");
      const sequenceOf = (text: string) => Number(text.match(/SEQUENCE:(\d+)/)?.[1] ?? 0);
      expect(sequenceOf(file.content)).toBeGreaterThan(sequenceOf(approval));
    });
  }

  test("the approval file has no cancel fields: the approval and the reminder keep their file", () => {
    const [approved] = decisionEmail({ ...booking, status: "approved" } as Booking, offer, "approved").attachments ?? [];
    expect(approved.content).not.toContain("METHOD:CANCEL");
    expect(approved.content).not.toContain("STATUS:CANCELLED");
  });

  test("a booking that was not approved gets no attachment", () => {
    expect(cancelEmail(booking, offer, "nina", false).attachments).toBeUndefined();
    expect(cancelEmail(booking, offer, "dancer").attachments).toBeUndefined();
  });
});
