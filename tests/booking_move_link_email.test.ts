// The cancel link of the emails (#650): the request email names the move (a waiting request can move), the approved and
// the reminder email keep the cancel texts (Nina's answer C on #647: an approved booking cannot move). The HTML part and
// the plain text of each email have the same cancel link.
import { DateTime } from "luxon";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import {
  decisionEmail,
  reminderEmail,
  reminderEmailHtml,
  requestEmail,
  requestEmailHtml,
} from "../src/lib/booking-email";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();
const ORIGIN = "https://tumach.dance";
const CANCEL_LINK = /https:\/\/tumach\.dance\/(en|nl)\/booking\/cancel\S+/;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

function booked(locale: string) {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: START,
      end: START + 60 * 60_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale,
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`the booking should be ok: ${result.reason}`);
  return { booking: result.booking, offer };
}

function linkOf(text: string): string {
  const match = text.match(CANCEL_LINK);
  if (!match) throw new Error("no cancel link in the text");
  return match[0];
}

describe("request email names the move (#650)", () => {
  test("English: the move and the cancel with the link", () => {
    const { booking, offer } = booked("en");
    const email = requestEmail(booking, offer, "en", ORIGIN);
    expect(email.text).toContain(
      "Another time, or can you not come? Move or cancel the booking with this link, at any time before the start:",
    );
    expect(email.text).not.toContain("Can you not come? Cancel the booking with this link");
  });

  test("Dutch: the move and the cancel with the link", () => {
    const { booking, offer } = booked("nl");
    const email = requestEmail(booking, offer, "nl", ORIGIN);
    expect(email.text).toContain(
      "Een andere tijd, of kun je niet komen? Verplaats of annuleer de boeking met deze link",
    );
  });

  test("the HTML part has the move button and the same link as the plain text", async () => {
    const { booking, offer } = booked("en");
    const plain = requestEmail(booking, offer, "en", ORIGIN);
    const mail = await requestEmailHtml(booking, offer, "en", ORIGIN);
    const html = mail.html as string;
    expect(html).toContain("Move or cancel the booking</");
    expect(html).toContain("Another time, or can you not come?");
    expect(html).toContain(linkOf(plain.text));
    expect(html).toContain(linkOf(mail.text));
    expect(linkOf(mail.text)).toBe(linkOf(plain.text));
  });

  test("the Dutch HTML part names the move in Dutch", async () => {
    const { booking, offer } = booked("nl");
    const mail = await requestEmailHtml(booking, offer, "nl", ORIGIN);
    const html = mail.html as string;
    expect(html).toContain("Boeking verplaatsen of annuleren</");
    expect(html).toContain("Een andere tijd, of kun je niet komen?");
  });
});

describe("approved and reminder emails keep the cancel texts (#647 C)", () => {
  test("the approval email: the cancel link, not the move", () => {
    const { booking, offer } = booked("en");
    const email = decisionEmail(booking, offer, "approved", ORIGIN);
    expect(email.text).toContain("Can you not come? Cancel the booking with this link");
    expect(email.text).not.toContain("Move or cancel");
  });

  test("the reminder email: the cancel button, not the move; the HTML link is the cancel link", async () => {
    // The plain text of the reminder has no cancel link (not changed by #650): only the HTML part is checked here.
    const { booking, offer } = booked("en");
    const plain = reminderEmail(booking, offer, ORIGIN);
    expect(plain.text).not.toMatch(CANCEL_LINK);
    const mail = await reminderEmailHtml(booking, offer, ORIGIN);
    const html = mail.html as string;
    expect(html).toContain("Cancel the booking</");
    expect(html).not.toContain("Move or cancel");
    expect(html).toMatch(/https:\/\/tumach\.dance\/en\/booking\/cancel\S+/);
  });
});
