// Nina removes the data of a dancer from the week page (#363): the coming bookings are cancelled with the cancel
// email first, then the name, email and phone of each booking of that dancer are removed.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { forgetDancerOfBooking } from "../src/lib/booking-forget";

const NOW = Date.UTC(2026, 10, 2, 12);
const HOUR = 3_600_000;
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "forget-week-"));
  process.env.EMAIL_LOG_FILE = join(dir, "mail.jsonl");
});
afterEach(() => {
  delete process.env.EMAIL_LOG_FILE;
  rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const add = (start: number, email: string, status: "requested" | "approved" | "cancelled") =>
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start,
        end: start + HOUR,
        name: "Ana",
        email,
        phone: "+31 6 12345678",
        locale: "en",
        status,
        createdAt: NOW - 100 * HOUR,
      })
      .returning()
      .get();
  return { db, add };
}

describe("forgetDancerOfBooking", () => {
  test("cancels the coming bookings with an email, then removes the data of each booking of that dancer", async () => {
    const { db, add } = setup();
    const past = add(NOW - 48 * HOUR, "ana@example.com", "approved");
    const coming = add(NOW + 48 * HOUR, "Ana@Example.com", "approved");
    const asked = add(NOW + 72 * HOUR, "ana@example.com", "requested");
    const other = add(NOW + 48 * HOUR, "bo@example.com", "approved");

    const removed = await forgetDancerOfBooking(db, past.id, NOW);

    expect(removed.sort()).toEqual([past.id, coming.id, asked.id].sort());
    const row = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get();
    expect(row(past.id)?.status).toBe("approved");
    expect(row(coming.id)?.status).toBe("cancelled");
    expect(row(asked.id)?.status).toBe("cancelled");
    for (const id of removed) expect([row(id)?.name, row(id)?.email, row(id)?.phone]).toEqual(["", "", ""]);
    expect(row(other.id)?.email).toBe("bo@example.com");
    const mails = readFileSync(process.env.EMAIL_LOG_FILE as string, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(mails.map((m) => m.to).sort()).toEqual(["Ana@Example.com", "ana@example.com"]);
    expect(mails.every((m) => m.text.includes("Hi Ana,"))).toBe(true);
  });

  test("a booking with no email (already removed) changes nothing", async () => {
    const { db, add } = setup();
    const gone = add(NOW + 48 * HOUR, "", "approved");
    expect(await forgetDancerOfBooking(db, gone.id, NOW)).toEqual([]);
    expect(await forgetDancerOfBooking(db, 9999, NOW)).toEqual([]);
  });
});
