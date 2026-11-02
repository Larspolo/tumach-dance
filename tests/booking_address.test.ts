// The address of the studio in the reminder email and in the calendar feed, from STUDIO_ADDRESS (#345, #540).
import { DateTime } from "luxon";
import { afterEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { reminderEmail, reminderEmailHtml } from "../src/lib/booking-email";
import { calendarFeed } from "../src/lib/calendar-feed";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();
const ADDRESS = "Teststraat 1, 1000 AA Amsterdam";

afterEach(() => vi.unstubAllEnvs());

let slot = 0;

/** An approved booking in its own slot (one booking per slot). */
function approved(db: Db, locale: string) {
  const start = START + slot++ * 3_600_000;
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input: BookingInput = {
    offerId: offer.id,
    start,
    end: start + 3_600_000,
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 12345678",
    locale,
  };
  const r = requestBooking(db, input, { now: NOW });
  if (!r.ok) throw new Error(r.reason);
  decideBooking(db, r.booking.id, "approved", null, NOW);
  return { booking: { ...r.booking, status: "approved" as const }, offer };
}

test("the reminder email has the address in English and Dutch, text and HTML", async () => {
  vi.stubEnv("STUDIO_ADDRESS", ADDRESS);
  const db = openDb(":memory:");
  for (const [locale, word] of [
    ["en", "Where:"],
    ["nl", "Waar:"],
  ]) {
    const { booking, offer } = approved(db, locale);
    expect(reminderEmail(booking, offer).text).toContain(`${word} ${ADDRESS}`);
    const html = await reminderEmailHtml(booking, offer, "https://tumach.dance");
    expect(html.text).toContain(`${word} ${ADDRESS}`);
    expect(html.html).toContain(`${word} ${ADDRESS}`);
  }
});

test("no setting: the reminder email has no address line", () => {
  vi.stubEnv("STUDIO_ADDRESS", "");
  const db = openDb(":memory:");
  const { booking, offer } = approved(db, "en");
  expect(reminderEmail(booking, offer).text).not.toContain("Where:");
});

test("the calendar feed has one LOCATION line with the escaped address in each event", async () => {
  vi.stubEnv("STUDIO_ADDRESS", ADDRESS);
  const db = openDb(":memory:");
  approved(db, "en");
  approved(db, "en");
  const text = (await calendarFeed(db, "en", NOW)).replace(/\r\n[ \t]/g, "");
  const locations = text.split("\r\n").filter((line) => line.startsWith("LOCATION:"));
  expect(locations).toHaveLength(2);
  for (const line of locations) expect(line).toBe(`LOCATION:${ADDRESS.replace(",", "\\,")}`);
});

test("no setting: the calendar feed has no LOCATION line", async () => {
  vi.stubEnv("STUDIO_ADDRESS", "");
  const db = openDb(":memory:");
  approved(db, "en");
  const text = await calendarFeed(db, "en", NOW);
  expect(text).not.toContain("LOCATION");
});
