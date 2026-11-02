// The calendar feed in the week of the start of summer time (#313, epic #100).
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { getCalendarToken } from "../src/lib/calendar-token";

let db: Db;
vi.mock("../src/db", async (orig) => ({ ...(await orig<typeof import("../src/db")>()), getDb: () => db }));
const { GET } = await import("../src/app/api/calendar/[file]/route");

const NOW = DateTime.fromISO("2027-03-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

beforeEach(() => {
  db = openDb(":memory:");
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

function book(start: string, name: string, decision?: "approved" | "declined"): number {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input: BookingInput = {
    offerId: offer.id,
    start: at(start),
    end: at(start) + 60 * 60_000,
    name,
    email: "a@example.com",
    phone: "+31 6 1234 5678",
    locale: "en",
  };
  const r = requestBooking(db, input, { now: NOW });
  if (!r.ok) throw new Error(`no booking: ${r.reason}`);
  if (decision) decideBooking(db, r.booking.id, decision);
  return r.booking.id;
}

const get = (token: string) =>
  GET(new Request(`http://x/api/calendar/${token}.ics`, { headers: { "accept-language": "en" } }), {
    params: Promise.resolve({ file: `${token}.ics` }),
  });

test("the feed gives the right UTC time before and on the day summer time starts", async () => {
  book("2027-03-27T19:00", "Ana", "approved"); // still winter time: 19:00 local is 18:00 UTC
  book("2027-03-28T19:00", "Bor", "approved"); // the day summer time starts: 19:00 local is 17:00 UTC
  const res = await get(getCalendarToken(db));
  expect(res.status).toBe(200);
  const text = (await res.text()).replace(/\r\n[ \t]/g, ""); // unfold the long lines (RFC 5545)
  expect(text).toContain("SUMMARY:Private lesson\\, 60 min: Ana");
  expect(text).toContain("SUMMARY:Private lesson\\, 60 min: Bor");
  expect(text).toMatch(/DTSTART:20270327T180000Z/);
  expect(text).toMatch(/DTSTART:20270328T170000Z/);
});
