// The action `fix` with a price (#761): a new address gets the approval email with the new price; no price field keeps it.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { decideBooking, requestBooking, UNDO_MS } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { saveHoursRule } from "../src/lib/hours-store";

const state = vi.hoisted(() => ({ db: undefined as unknown, sent: [] as { to: string; text: string }[] }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: { to: string; text: string }) => {
    state.sent.push(email);
  }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("../src/lib/auth", () => ({ getStudioSession: async () => ({ user: { email: "nina@example.com" } }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));

const { fix } = await import("../src/app/studio/week/actions");

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
// Sunday 2026-10-25: the day that summer time ends.
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  state.sent = [];
});
afterEach(() => vi.useRealTimers());

function booked() {
  const db: Db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: START,
      end: START + 3_600_000,
      name: "Ana",
      email: "ana@exmple.com",
      phone: "+31 6 12345678",
      locale: "en",
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(result.reason);
  state.db = db;
  const price = () => db.select().from(bookings).where(eq(bookings.id, result.booking.id)).get()?.priceCents;
  return { db, id: result.booking.id, price };
}

async function runFix(id: number, fields: Record<string, string>) {
  const form = new FormData();
  form.set("start", "2026-10-19");
  form.set("id", String(id));
  form.set("name", "Ana");
  form.set("phone", "+31 6 12345678");
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  await expect(fix(form)).rejects.toThrow(/redirect/);
}

test("a new address and a new price send the approval email with the new price", async () => {
  const { db, id, price } = booked();
  expect(decideBooking(db, id, "approved", null, NOW).ok).toBe(true);
  db.update(bookings)
    .set({ decisionMailedAt: NOW + UNDO_MS })
    .where(eq(bookings.id, id))
    .run();
  await runFix(id, { email: "ana@example.com", price: "45" });
  expect(price()).toBe(4500);
  expect(state.sent).toHaveLength(1);
  expect(state.sent[0].text).toContain("45.00");
  expect(state.sent[0].text).not.toContain("60.00");
});

test("a form with no price field keeps the price", async () => {
  const { id, price } = booked();
  await runFix(id, { email: "ana@exmple.com" });
  expect(price()).toBe(6000);
});

test("a wrong price changes nothing", async () => {
  const { id, price } = booked();
  const form = new FormData();
  form.set("start", "2026-10-19");
  form.set("id", String(id));
  form.set("name", "Ana B");
  form.set("email", "ana@example.com");
  form.set("phone", "+31 6 12345678");
  form.set("price", "abc");
  await expect(fix(form)).rejects.toThrow(/wrong=price/);
  expect(price()).toBe(6000);
  expect(state.sent).toEqual([]);
});
