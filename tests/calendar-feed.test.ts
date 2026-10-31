// The secret calendar feed of the approved bookings (#103).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { getCalendarToken, renewCalendarToken } from "../src/lib/calendar-token";

let db: Db;
vi.mock("../src/db", async (orig) => ({ ...(await orig<typeof import("../src/db")>()), getDb: () => db }));
const { GET } = await import("../src/app/api/calendar/[file]/route");

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
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

test("the feed has each approved booking and no other", async () => {
  book("2026-10-25T19:00", "Ana", "approved");
  book("2026-10-31T14:00", "Bor", "approved");
  book("2026-11-01T14:00", "Cene");
  book("2026-11-01T16:00", "Dora", "declined");
  const cancelled = book("2026-11-07T14:00", "Eva", "approved");
  db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, cancelled)).run();
  const res = await get(getCalendarToken(db));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/calendar");
  const text = (await res.text()).replace(/\r\n[ \t]/g, ""); // unfold the long lines (RFC 5545)
  expect(text).toContain("SUMMARY:Private lesson\\, 60 min: Ana");
  expect(text).toContain("SUMMARY:Private lesson\\, 60 min: Bor");
  expect(text).toContain("+31 6 1234 5678");
  for (const name of ["Cene", "Dora", "Eva"]) expect(text).not.toContain(name);
  // 2026-10-25 is the day the summer time ends: 19:00 local is 18:00 UTC.
  expect(text).toMatch(/DTSTART:20261025T180000Z/);
});

test("a wrong token and the old token after a renewal give 404", async () => {
  const old = getCalendarToken(db);
  expect((await get("wrong")).status).toBe(404);
  const fresh = renewCalendarToken(db);
  expect(fresh).not.toBe(old);
  expect((await get(old)).status).toBe(404);
  expect((await get(fresh)).status).toBe(200);
});
