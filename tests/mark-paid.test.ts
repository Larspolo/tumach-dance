// Nina marks an approved booking paid with one tap, or undoes a wrong tap (#143).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { decideBooking, markPaid, requestBooking, unmarkPaid } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-10-20T12:00");
const state = vi.hoisted(() => ({ db: undefined as unknown, session: true as boolean }));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("@/db", async (real) => ({ ...(await real<object>()), getDb: () => state.db }));
vi.mock("@/lib/auth", () => ({ getStudioSession: async () => (state.session ? { user: {} } : null) }));
vi.mock("@/lib/booking-email", () => ({ sendDecisionEmail: async () => {} }));

function booking(start = "2026-11-07T14:00") {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: at(start),
      end: at(start) + 60 * 60_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(result.reason);
  state.db = db;
  return { db, id: result.booking.id };
}

const paidAt = (db: ReturnType<typeof openDb>, id: number) =>
  db.select().from(bookings).where(eq(bookings.id, id)).get()?.paidAt;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

beforeEach(() => {
  state.session = true;
});

test("the Paid action marks an approved booking paid; a second tap keeps one paidAt", async () => {
  const { pay } = await import("../src/app/studio/bookings/actions");
  const { db, id } = booking();
  decideBooking(db, id, "approved");
  await expect(pay(form({ id: String(id), paid: "paid" }))).rejects.toThrow("redirect /studio/bookings");
  const first = paidAt(db, id);
  expect(first).toBeTypeOf("number");
  await expect(pay(form({ id: String(id), paid: "paid" }))).rejects.toThrow("redirect /studio/bookings");
  expect(paidAt(db, id)).toBe(first);
});

test("Undo clears paidAt, and a second Undo changes nothing", async () => {
  const { pay } = await import("../src/app/studio/bookings/actions");
  const { db, id } = booking();
  decideBooking(db, id, "approved");
  markPaid(db, id, NOW);
  await expect(pay(form({ id: String(id), paid: "undo" }))).rejects.toThrow("redirect /studio/bookings");
  expect(paidAt(db, id)).toBeNull();
  expect(unmarkPaid(db, id)).toEqual({ ok: false, reason: "not-paid" });
  expect(unmarkPaid(db, 999)).toEqual({ ok: false, reason: "not-found" });
});

test("a pending or declined booking cannot be marked paid", () => {
  const pending = booking();
  expect(markPaid(pending.db, pending.id, NOW)).toEqual({ ok: false, reason: "not-approved" });
  const declined = booking();
  decideBooking(declined.db, declined.id, "declined");
  expect(markPaid(declined.db, declined.id, NOW)).toEqual({ ok: false, reason: "not-approved" });
  expect(paidAt(declined.db, declined.id)).toBeNull();
});

test("with no session the action goes to the login and changes nothing", async () => {
  const { pay } = await import("../src/app/studio/bookings/actions");
  const { db, id } = booking();
  decideBooking(db, id, "approved");
  state.session = false;
  await expect(pay(form({ id: String(id), paid: "paid" }))).rejects.toThrow(/redirect \/studio\/login|redirect/);
  expect(paidAt(db, id)).toBeNull();
});
