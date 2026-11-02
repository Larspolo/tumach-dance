// The button "Add to my calendar" of Nina (#535): the calendar file of one approved booking, only on her tap.
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";

let db: Db;
vi.mock("../src/db", async (orig) => ({ ...(await orig<typeof import("../src/db")>()), getDb: () => db }));
const { GET } = await import("../src/app/api/studio/bookings/[file]/route");

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

beforeEach(() => {
  db = openDb(":memory:");
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

function book(start: string, decision?: "approved" | "declined"): number {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input: BookingInput = {
    offerId: offer.id,
    start: at(start),
    end: at(start) + 60 * 60_000,
    name: "Ana",
    email: "a@example.com",
    phone: "+31 6 1234 5678",
    locale: "en",
  };
  const r = requestBooking(db, input, { now: NOW });
  if (!r.ok) throw new Error(`no booking: ${r.reason}`);
  if (decision) decideBooking(db, r.booking.id, decision);
  return r.booking.id;
}

const get = (file: string, lang = "nl") =>
  GET(new Request(`http://x/api/studio/bookings/${file}`, { headers: { "accept-language": lang } }), {
    params: Promise.resolve({ file }),
  });

test("an approved booking gives a calendar file to download, in UTC on the day of the end of summer time", async () => {
  const id = book("2026-10-25T19:00", "approved");
  const res = await get(`${id}.ics`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
  expect(res.headers.get("content-disposition")).toBe(`attachment; filename="tumach-${id}.ics"`);
  const ics = await res.text();
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  // 19:00 winter time (UTC+1) is 18:00 UTC; summer time ended at 03:00 that night.
  expect(ics).toContain("DTSTART:20261025T180000Z");
  expect(ics).toContain("DTEND:20261025T190000Z");
  expect(ics).not.toContain("METHOD:REQUEST");
});

test("the day before the end of summer time is UTC+2", async () => {
  const id = book("2026-10-24T19:00", "approved");
  expect(await (await get(`${id}.ics`)).text()).toContain("DTSTART:20261024T170000Z");
});

test("a request, a declined booking, an unknown id and a bad name give 404", async () => {
  const requested = book("2026-10-26T19:00");
  const declined = book("2026-10-27T19:00", "declined");
  for (const file of [`${requested}.ics`, `${declined}.ics`, "999.ics", "abc.ics", `${requested}`]) {
    expect((await get(file)).status).toBe(404);
  }
});
