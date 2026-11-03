// The one email after a repeat (#678): every new date in Amsterdam time with its cancel link, one calendar event per new
// booking, the language of the booking, one email for the whole repeat, none with no dancer email, and a failed send
// does not throw.
import { DateTime } from "luxon";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { offers as offersTable } from "../src/db/schema";
import { cancelUrl } from "../src/lib/booking-cancel";
import { repeatEmail, sendRepeatEmail } from "../src/lib/booking-email";
import { repeatBooking } from "../src/lib/booking-repeat";
import { saveHoursRule } from "../src/lib/hours-store";
import { siteOrigin } from "../src/lib/site";

const mail = vi.hoisted(() => ({
  fail: false,
  sent: [] as { to: string; subject: string; text: string; attachments?: { content: string }[] }[],
}));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: unknown) => {
    if (mail.fail) throw new Error("Mailgun down");
    mail.sent.push(email as (typeof mail.sent)[number]);
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

/** An approved lesson on Sunday 25 October at 10:00, then the repeat of 4 weeks: the new bookings. */
function repeated(locale = "en") {
  const start = at("2026-10-25T10:00");
  const result = requestBooking(
    db,
    { offerId, start, end: start + HOUR, name: "Ana", email: "ana@example.com", phone: "+31 6 12345678", locale },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`the booking should be ok: ${result.reason}`);
  const decided = decideBooking(db, result.booking.id, "approved", null, NOW);
  if (!decided.ok) throw new Error(`the approval should be ok: ${decided.reason}`);
  const repeat = repeatBooking(db, decided.booking.id, 4, { now: NOW });
  if (!repeat.ok) throw new Error(`the repeat should be ok: ${repeat.reason}`);
  return repeat.added;
}

function offer() {
  return db.select().from(offersTable).get() as Parameters<typeof repeatEmail>[1];
}

describe("sendRepeatEmail", () => {
  test("a repeat of 4 weeks sends exactly one email with all the new dates", async () => {
    const added = repeated();
    expect(added).toHaveLength(4);
    await sendRepeatEmail(db, added);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("ana@example.com");
    expect(mail.sent[0].subject).toBe("Your lessons at TUMACH are booked");
  });

  test("each new date is in Amsterdam time, with its own cancel link and one calendar event", async () => {
    const added = repeated();
    await sendRepeatEmail(db, added);
    const [email] = mail.sent;
    for (const booking of added) expect(email.text).toContain(cancelUrl(siteOrigin(), booking));
    // Winter time from 26 October: 10:00 in Amsterdam is 09:00 UTC.
    const starts = ["20261101T090000Z", "20261108T090000Z", "20261115T090000Z", "20261122T090000Z"];
    const attachments = email.attachments ?? [];
    expect(attachments).toHaveLength(4);
    attachments.forEach((file, i) => {
      expect(file.content.match(/BEGIN:VEVENT/g)).toHaveLength(1);
      expect(file.content).toContain(`DTSTART:${starts[i]}`);
      expect(file.content).toContain(`UID:booking-${added[i].id}@tumach.dance`);
    });
  });

  test("the email is in the language of the booking", async () => {
    const added = repeated("nl");
    await sendRepeatEmail(db, added);
    expect(mail.sent[0].subject).toBe("Je lessen bij TUMACH zijn geboekt");
    expect(mail.sent[0].text).toContain("Hoi Ana,");
  });

  test("a dancer with no email gets no email", async () => {
    const [first] = repeated();
    await sendRepeatEmail(db, [{ ...first, email: "" }]);
    expect(mail.sent).toHaveLength(0);
  });

  test("a failed send does not throw", async () => {
    const added = repeated();
    mail.fail = true;
    await expect(sendRepeatEmail(db, added)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  test("repeatEmail builds the text without sending", () => {
    const added = repeated();
    const email = repeatEmail(added, offer(), "https://tumach.dance");
    expect(email.to).toBe("ana@example.com");
    expect(email.text).toContain("Hi Ana,");
    expect(email.attachments?.map((a) => a.filename)).toEqual([
      "tumach-1.ics",
      "tumach-2.ics",
      "tumach-3.ics",
      "tumach-4.ics",
    ]);
    expect(mail.sent).toHaveLength(0);
  });
});
