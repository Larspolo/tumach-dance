// The limits of the booking requests that do not depend on the connection (#541): at most 3 open requests per email
// address and 30 requests per day on the whole site; the day limit sends Nina one push in 24 hours.
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import { openDb } from "../src/db";
import { type BookingInput, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { saveHoursRule } from "../src/lib/hours-store";

const push = vi.hoisted(() => ({ sendPush: vi.fn() }));
vi.mock("../src/lib/push", () => push);
const email = vi.hoisted(() => ({ sendRequestEmail: vi.fn() }));
vi.mock("../src/lib/booking-email", () => email);
const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { sendRequest } = await import("../src/app/[locale]/book/actions");
const { formStamp, resetContactLimit } = await import("../src/lib/contact-spam");
const { bookingError } = await import("../src/lib/booking-error");
const { sendLimitPush } = await import("../src/lib/booking-limit-push");
const { DAY_MS } = await import("../src/lib/booking-limits");

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const HOUR = 3_600_000;
// Saturday 2026-10-31, open 09:00 to 17:00: 8 free slots of 60 minutes.
const at = (hour: number) => DateTime.fromISO("2026-10-31T09:00", { zone }).plus({ hours: hour }).toMillis();

function setup() {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sat: { from: "09:00", to: "17:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input = (hour: number, address = "ana@example.com"): BookingInput => ({
    offerId: offer.id,
    start: at(hour),
    end: at(hour) + HOUR,
    name: "Ana",
    email: address,
    phone: "+31 6 1234 5678",
    locale: "en",
  });
  /** A row of an older request, made `ago` ms before NOW: by default declined, so it holds no time. */
  const old = (
    ago: number,
    address: string,
    { status = "declined", start = at(0) }: { status?: "declined" | "requested"; start?: number } = {},
  ) =>
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        priceCents: offer.priceCents,
        start,
        end: start + HOUR,
        status,
        name: "Bot",
        email: address,
        phone: "+31 6 1234 5678",
        locale: "en",
        createdAt: NOW - ago,
      })
      .run();
  return { db, offer, input, old };
}

const count = (db: ReturnType<typeof setup>["db"]) => db.select().from(bookings).all().length;

describe("the limit of one email address", () => {
  test("the 4th open request of one address makes no booking, also with other upper and lower case", () => {
    const { db, input } = setup();
    for (const hour of [0, 1, 2]) expect(requestBooking(db, input(hour), { now: NOW }).ok).toBe(true);
    const fourth = requestBooking(db, input(3, "  ANA@Example.COM "), { now: NOW });
    expect(fourth).toEqual({ ok: false, reason: "limit", limit: "open" });
    expect(count(db)).toBe(3);
    expect(requestBooking(db, input(3, "bo@example.com"), { now: NOW }).ok).toBe(true);
  });

  test("a declined request and a request whose start is past count no more", () => {
    const { db, input, old } = setup();
    for (const hour of [0, 1, 2]) expect(requestBooking(db, input(hour), { now: NOW }).ok).toBe(true);
    db.update(bookings).set({ status: "declined" }).run();
    // Three open requests of the same address whose start is before now (they ended with no answer yet).
    for (let i = 0; i < 3; i++) old(HOUR, "ana@example.com", { status: "requested", start: NOW - HOUR });
    expect(requestBooking(db, input(3), { now: NOW }).ok).toBe(true);
    expect(requestBooking(db, input(4), { now: NOW }).ok).toBe(true);
    expect(requestBooking(db, input(5), { now: NOW }).ok).toBe(true);
    expect(requestBooking(db, input(6), { now: NOW })).toMatchObject({ reason: "limit", limit: "open" });
  });
});

describe("the limit of the day", () => {
  test("the 31st request in 24 hours from other addresses makes no booking", () => {
    const { db, input, old } = setup();
    for (let i = 0; i < 29; i++) old(i * 60_000, `bot${i}@example.com`);
    old(DAY_MS + 1, "older@example.com"); // more than 24 hours ago: does not count
    expect(requestBooking(db, input(0, "the30th@example.com"), { now: NOW }).ok).toBe(true);
    const result = requestBooking(db, input(1, "the31st@example.com"), { now: NOW });
    expect(result).toEqual({ ok: false, reason: "limit", limit: "day" });
    expect(count(db)).toBe(31);
    // 24 hours after the first rows, requests go again.
    expect(requestBooking(db, input(1, "later@example.com"), { now: NOW + DAY_MS }).ok).toBe(true);
  });
});

describe("the booking action over a limit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    resetContactLimit();
    push.sendPush.mockReset();
    push.sendPush.mockResolvedValue(1);
    email.sendRequestEmail.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function form(offerId: number, hour: number, address: string) {
    const f = new FormData();
    const fields = {
      locale: "nl",
      offerId: String(offerId),
      start: String(at(hour)),
      end: String(at(hour) + HOUR),
      name: "Ana",
      email: address,
      emailChecked: "1",
      phone: "+31 6 12345678",
      day: "2026-10-31",
    };
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    f.set("stamp", formStamp("booking", Date.now() - 5000));
    return f;
  }

  test("the 4th open request sends no email and no push, and the page gets limitOpen", async () => {
    const { db, offer } = setup();
    state.db = db;
    for (const hour of [0, 1, 2]) {
      await expect(sendRequest(form(offer.id, hour, "ana@example.com"))).rejects.toThrow("sent=1");
    }
    email.sendRequestEmail.mockClear();
    push.sendPush.mockClear();
    await expect(sendRequest(form(offer.id, 3, "ana@example.com"))).rejects.toThrow("error=limitOpen");
    expect(email.sendRequestEmail).not.toHaveBeenCalled();
    expect(push.sendPush).not.toHaveBeenCalled();
  });

  test("the 31st request gets limitDay and one push to Nina; the 32nd sends no second push", async () => {
    const { db, offer, old } = setup();
    state.db = db;
    for (let i = 0; i < 30; i++) old(i * 60_000, `bot${i}@example.com`);
    await expect(sendRequest(form(offer.id, 0, "a31@example.com"))).rejects.toThrow("error=limitDay");
    expect(email.sendRequestEmail).not.toHaveBeenCalled();
    expect(push.sendPush).toHaveBeenCalledTimes(1);
    const message = push.sendPush.mock.calls[0][1]("nl");
    expect(message.title).toBe(nl.bookingPush.limitTitle);
    expect(message.url).toBe("/studio/bookings");
    await expect(sendRequest(form(offer.id, 1, "a32@example.com"))).rejects.toThrow("error=limitDay");
    expect(push.sendPush).toHaveBeenCalledTimes(1);
    expect(email.sendRequestEmail).not.toHaveBeenCalled();
    expect(count(db)).toBe(30);
  });

  test("the push of the day limit goes again after 24 hours, and a failed push is logged", async () => {
    const { db } = setup();
    expect(await sendLimitPush(db, NOW)).toBe(true);
    expect(await sendLimitPush(db, NOW + DAY_MS - 1)).toBe(false);
    push.sendPush.mockRejectedValue(new Error("no VAPID keys"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendLimitPush(db, NOW + DAY_MS)).toBe(true);
    expect(log).toHaveBeenCalledTimes(1);
    expect(await sendLimitPush(db, NOW + DAY_MS + 1)).toBe(false);
  });
});

test("each limit has its own message on the page in English and Dutch", () => {
  expect(bookingError({ ok: false, reason: "limit", limit: "open" })).toBe("limitOpen");
  expect(bookingError({ ok: false, reason: "limit", limit: "day" })).toBe("limitDay");
  for (const messages of [en, nl]) {
    for (const key of ["limitOpen", "limitDay"] as const) expect(messages.Book[key].length).toBeGreaterThan(20);
    expect(messages.bookingPush.limitTitle).toBeTruthy();
    expect(messages.bookingPush.limitBody).toBeTruthy();
  }
  expect(nl.Book.limitOpen).not.toBe(en.Book.limitOpen);
  expect(nl.Book.limitDay).not.toBe(en.Book.limitDay);
});
