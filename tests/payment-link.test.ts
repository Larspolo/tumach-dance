// The price and the Tikkie link in the approval email (#142); a link that is not https:// is refused.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { saveHoursRule } from "../src/lib/hours-store";
import { tikkieLink } from "../src/lib/tikkie";

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("../src/lib/auth", () => ({ getStudioSession: async () => ({ user: { email: "nina@example.com" } }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));

const { decisionEmail } = await import("../src/lib/booking-email");
const { decide } = await import("../src/app/studio/bookings/actions");

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());
const LINK = "https://tikkie.me/pay/Tumach/abc123";

function booked(locale = "en") {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6500, position: 0 });
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: START,
      end: START + 3_600_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale,
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(result.reason);
  state.db = db;
  return { db, offer, booking: result.booking };
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

describe("the approval email", () => {
  test("has the price of the offer and the Tikkie link that Nina gave", () => {
    const { db, offer, booking } = booked();
    const result = decideBooking(db, booking.id, "approved", LINK);
    if (!result.ok) throw new Error(result.reason);
    const email = decisionEmail(result.booking, offer, "approved");
    expect(email.text).toContain(`The price is €65.00. Please pay with this Tikkie: ${LINK}`);
  });

  test("with no link: the price and that Nina sends a Tikkie, in the language of the booking", () => {
    const { db, offer, booking } = booked("nl");
    const result = decideBooking(db, booking.id, "approved");
    if (!result.ok) throw new Error(result.reason);
    const email = decisionEmail(result.booking, offer, "approved");
    expect(email.text).toMatch(/De prijs is €\s65,00\. Nina stuurt je een Tikkie om te betalen\./);
  });

  test("the approval action stores the link", async () => {
    const { db, booking } = booked();
    await expect(decide(form({ id: String(booking.id), decision: "approved", tikkie: ` ${LINK} ` }))).rejects.toThrow(
      "redirect /studio/bookings?done=approved",
    );
    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()).toMatchObject({
      status: "approved",
      tikkieUrl: LINK,
    });
  });

  test("a link that is not https:// is refused, and the request stays open", async () => {
    const { db, booking } = booked();
    await expect(
      decide(form({ id: String(booking.id), decision: "approved", tikkie: "http://tikkie.me/x" })),
    ).rejects.toThrow("redirect /studio/bookings?error=link");
    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.status).toBe("requested");
  });
});

test("tikkieLink: empty, https and other texts", () => {
  expect(tikkieLink(null)).toBeNull();
  expect(tikkieLink("  ")).toBeNull();
  expect(tikkieLink(LINK)).toBe(LINK);
  expect(tikkieLink("javascript:alert(1)")).toBe("invalid");
  expect(tikkieLink("tikkie.me/x")).toBe("invalid");
});
