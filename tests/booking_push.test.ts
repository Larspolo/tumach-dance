// The push to Nina for each new booking request (#75): the texts in Amsterdam time, one push per request, and a
// failed push that keeps the booking.
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { listOpenRequests, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { saveHoursRule } from "../src/lib/hours-store";

const push = vi.hoisted(() => ({ sendPush: vi.fn() }));
vi.mock("../src/lib/push", () => push);
const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock("../src/lib/booking-email", () => ({ sendRequestEmail: vi.fn() }));

const { requestPush, sendRequestPush } = await import("../src/lib/booking-push");
const { sendRequest } = await import("../src/app/[locale]/book/actions");

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
// Sunday 2026-10-25: the day that summer time ends. 10:00 local is 10:00 CET (09:00 UTC).
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();

function setup() {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  return { db, offer };
}

function form(offerId: number) {
  const f = new FormData();
  const fields = {
    locale: "nl",
    offerId: String(offerId),
    start: String(START),
    end: String(START + 60 * 60_000),
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 12345678",
    day: "2026-10-25",
  };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  push.sendPush.mockReset();
  push.sendPush.mockResolvedValue(1);
});
afterEach(() => vi.useRealTimers());

describe("requestPush", () => {
  const { db, offer } = setup();
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: START,
      end: START + 3_600_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale: "sl",
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(result.reason);
  const booking = result.booking;

  test.each([
    ["en", "New booking request", "Ana: Private lesson, 60 min, Oct 25, 2026, 10:00 AM"],
    ["nl", "Nieuwe aanvraag", "Ana: Privéles, 60 min, 25 okt 2026, 10:00"],
    ["sl", "Nova prošnja za rezervacijo", "Ana: Zasebna ura, 60 min, 25. okt. 2026, 10:00"],
  ] as const)("%s: the offer and the Amsterdam time on 2026-10-25", (locale, title, body) => {
    const message = requestPush(booking, offer, locale);
    expect(message.title).toBe(title);
    expect(message.body.replace(/ /g, " ")).toContain(body);
    expect(message.body).toContain("10:00");
    expect(message.body).toContain("2026");
    expect(message.url).toBe("/studio/bookings");
  });
});

describe("the booking action", () => {
  test("a request sends one push to /studio/bookings", async () => {
    const { db, offer } = setup();
    state.db = db;
    await expect(sendRequest(form(offer.id))).rejects.toThrow("redirect /nl/book?sent=1");
    expect(push.sendPush).toHaveBeenCalledTimes(1);
    const message = push.sendPush.mock.calls[0][1]("en");
    expect(message.url).toBe("/studio/bookings");
  });

  test("a taken time sends no push", async () => {
    const { db, offer } = setup();
    state.db = db;
    await expect(sendRequest(form(offer.id))).rejects.toThrow("sent=1");
    push.sendPush.mockClear();
    await expect(sendRequest(form(offer.id))).rejects.toThrow("error=taken");
    expect(push.sendPush).not.toHaveBeenCalled();
  });

  test("a failed push still stores the booking", async () => {
    const { db, offer } = setup();
    state.db = db;
    push.sendPush.mockRejectedValue(new Error("no VAPID keys"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendRequest(form(offer.id))).rejects.toThrow("sent=1");
    expect(listOpenRequests(db)).toHaveLength(1);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  test("sendRequestPush logs a missing offer and does not throw", async () => {
    const { db } = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendRequestPush(db, { id: 9, offerId: 999 } as never);
    expect(push.sendPush).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
