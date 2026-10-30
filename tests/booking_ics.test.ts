// The calendar file of the reminder email (#166): one event in UTC, also on the day of the change to summer time.
import { DateTime } from "luxon";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Booking } from "../src/db/bookings";
import type { Offer } from "../src/db/offers";
import { reminderEmail } from "../src/lib/booking-email";
import { bookingEvent } from "../src/lib/booking-ics";
import { sendEmail } from "../src/lib/email";

const zone = "Europe/Amsterdam";
// 2027-03-28: the clocks go from 02:00 to 03:00. 10:00 summer time is 08:00 UTC.
const START = DateTime.fromISO("2027-03-28T10:00", { zone }).toMillis();
const offer = { id: 1, kind: "lesson", minutes: 60, priceCents: 6000, position: 0 } as unknown as Offer;
const booking = {
  id: 7,
  offerId: 1,
  start: START,
  end: START + 60 * 60_000,
  name: "Ana",
  email: "ana@example.com",
  phone: "+31600000000",
  locale: "nl",
  status: "approved",
} as unknown as Booking;

afterEach(() => vi.unstubAllGlobals());

describe("bookingEvent", () => {
  test("one event at the start and the end in UTC, on the day of the change to summer time", () => {
    const ics = bookingEvent(booking, offer, "en");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("DTSTART:20270328T080000Z");
    expect(ics).toContain("DTEND:20270328T090000Z");
    expect(ics).toContain("SUMMARY:TUMACH: ");
  });

  test("the reminder email attaches it as tumach.ics", () => {
    const email = reminderEmail(booking, offer);
    expect(email.attachments).toHaveLength(1);
    const [file] = email.attachments ?? [];
    expect(file.filename).toBe("tumach.ics");
    expect(file.contentType).toBe("text/calendar");
    expect(file.content).toContain("DTSTART:20270328T080000Z");
  });

  test("the Mailgun request has the attachment", async () => {
    const fetchStub = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);
    await sendEmail(reminderEmail(booking, offer), {
      MAILGUN_API_KEY: "k",
      MAILGUN_DOMAIN: "mg.example",
    } as unknown as NodeJS.ProcessEnv);
    const body = (fetchStub.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("to")).toBe("ana@example.com");
    const file = body.get("attachment") as File;
    expect(file.name).toBe("tumach.ics");
    expect(await file.text()).toContain("DTEND:20270328T090000Z");
  });
});
