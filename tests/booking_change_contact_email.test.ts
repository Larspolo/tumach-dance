// After Nina corrects the email address of a booking, the dancer gets the last email again at the new address (#760).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { decideBooking, requestBooking, UNDO_MS } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { saveHoursRule } from "../src/lib/hours-store";

const state = vi.hoisted(() => ({ db: undefined as unknown, sent: [] as { to: string; subject: string }[] }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: { to: string; subject: string }) => {
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
  return { db, id: result.booking.id };
}

async function runFix(id: number, fields: { name?: string; email?: string; phone?: string }) {
  const form = new FormData();
  form.set("start", "2026-10-19");
  form.set("id", String(id));
  form.set("name", fields.name ?? "Ana");
  form.set("email", fields.email ?? "ana@exmple.com");
  form.set("phone", fields.phone ?? "+31 6 12345678");
  await expect(fix(form)).rejects.toThrow(/redirect/);
}

describe("fix sends the last email again", () => {
  test("a new email of a request sends one request email to the new address", async () => {
    const { id } = booked();
    await runFix(id, { email: "ana@example.com" });
    expect(state.sent.map((m) => m.to)).toEqual(["ana@example.com"]);
  });

  test("a new email of an approved booking whose approval went out sends one approval email", async () => {
    const { db, id } = booked();
    expect(decideBooking(db, id, "approved", null, NOW).ok).toBe(true);
    db.update(bookings)
      .set({ decisionMailedAt: NOW + UNDO_MS })
      .where(eq(bookings.id, id))
      .run();
    await runFix(id, { email: "ana@example.com" });
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].to).toBe("ana@example.com");
    expect(state.sent[0].subject).not.toBe("");
  });

  test("an approved booking in its undo time sends no email", async () => {
    const { db, id } = booked();
    expect(decideBooking(db, id, "approved", null, NOW).ok).toBe(true);
    await runFix(id, { email: "ana@example.com" });
    expect(state.sent).toEqual([]);
  });

  test("a change of only the name or the phone sends no email", async () => {
    const { id } = booked();
    await runFix(id, { name: "Ana B" });
    await runFix(id, { phone: "+31 6 87654321" });
    expect(state.sent).toEqual([]);
  });

  test("an empty new email sends no email", async () => {
    const { id } = booked();
    await runFix(id, { email: "" });
    expect(state.sent).toEqual([]);
  });
});
