// The push to Nina when a dancer cancels with the link (#210): one push per cancel, in the language of each device,
// in Amsterdam time, and no push for a cancel that does nothing.
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";

const push = vi.hoisted(() => ({ sendPush: vi.fn() }));
vi.mock("../src/lib/push", () => push);
const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock("../src/lib/booking-email", () => ({ sendCancelEmail: vi.fn() }));

const { cancelPush } = await import("../src/lib/booking-push");
const { cancelWithLink } = await import("../src/app/[locale]/booking/cancel/actions");

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
// Sunday 2026-10-25: the day that summer time ends. 10:00 local is 10:00 CET (09:00 UTC).
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();

function setup() {
  const db = openDb(":memory:");
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
      locale: "nl",
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error("the request must be stored");
  state.db = db;
  return { db: db as Db, offer, booking: result.booking };
}

function form(token: string) {
  const f = new FormData();
  f.set("token", token);
  f.set("locale", "nl");
  return f;
}

async function cancel(token: string) {
  await expect(cancelWithLink(form(token))).rejects.toThrow(/redirect/);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  push.sendPush.mockReset();
  push.sendPush.mockResolvedValue(1);
});
afterEach(() => vi.useRealTimers());

describe("cancelPush", () => {
  test("names the dancer, the offer and the Amsterdam time, and links to the week", () => {
    const { booking, offer } = setup();
    const en = cancelPush(booking, offer, "en");
    expect(en.title).toBe("Booking cancelled");
    expect(en.body).toContain("Ana");
    expect(en.body).toContain("10:00");
    expect(en.url).toBe("/studio/week?start=2026-10-19");
    expect(cancelPush(booking, offer, "nl").title).toBe("Boeking geannuleerd");
    expect(cancelPush(booking, offer, "sl").title).toBe("Rezervacija preklicana");
  });
});

describe("cancelWithLink", () => {
  test("sends one push, with a text for each device language", async () => {
    const { booking } = setup();
    await cancel(booking.cancelToken);
    expect(push.sendPush).toHaveBeenCalledTimes(1);
    const make = push.sendPush.mock.calls[0][1] as (l: string) => { title: string };
    expect(make("nl").title).toBe("Boeking geannuleerd");
    expect(make("en").title).toBe("Booking cancelled");
  });

  test("sends no push for a wrong token, a second cancel or a started booking", async () => {
    const { booking } = setup();
    await cancel("wrong");
    await cancel(booking.cancelToken);
    push.sendPush.mockClear();
    await cancel(booking.cancelToken);
    const other = setup();
    vi.setSystemTime(START + 60_000);
    await cancel(other.booking.cancelToken);
    expect(push.sendPush).not.toHaveBeenCalled();
  });

  test("a failed push keeps the cancel", async () => {
    const { booking } = setup();
    push.sendPush.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await cancel(booking.cancelToken);
    expect(push.sendPush).toHaveBeenCalledTimes(1);
    await cancel(booking.cancelToken);
    expect(push.sendPush).toHaveBeenCalledTimes(1);
  });
});
