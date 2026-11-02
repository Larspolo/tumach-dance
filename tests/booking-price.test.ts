// Each booking keeps the price of its offer at the time of the request (#596).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, expect, test } from "vitest";
import { MIGRATIONS_FOLDER, openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { runMigrations } from "../src/db/migrate";
import { addOffer, updateOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const START = DateTime.fromISO("2026-11-07T14:00", { zone: "Europe/Amsterdam" }).toMillis();

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("a booking keeps the price of the request after a price change of its offer", () => {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input = { offerId: offer.id, start: START, end: START + 3_600_000, name: "Ana", email: "ana@example.com" };
  const result = requestBooking(db, { ...input, phone: "+31 6 1234 5678", locale: "nl" }, { now: NOW });
  if (!result.ok) throw new Error(result.reason);
  expect(result.booking.priceCents).toBe(6000);
  expect(updateOffer(db, offer.id, { priceCents: 7000 })?.priceCents).toBe(7000);
  const row = db.select().from(bookings).where(eq(bookings.id, result.booking.id)).get();
  expect(row?.priceCents).toBe(6000);
});

test("the migration fills the price of an existing booking from its offer", () => {
  const dir = mkdtempSync(join(tmpdir(), "price-"));
  dirs.push(dir);
  const folder = join(dir, "drizzle");
  cpSync(MIGRATIONS_FOLDER, folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const index = journal.entries.findIndex((e: { tag: string }) => e.tag === "0016_sleepy_beast");
  expect(index).toBeGreaterThan(0);
  writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, index) }));
  const sqlite = new Database(join(dir, "db.sqlite"));
  runMigrations(sqlite, folder);
  sqlite
    .prepare("INSERT INTO offers (id, kind, minutes, price_cents, position) VALUES (1, 'lesson', 60, 5500, 0)")
    .run();
  sqlite
    .prepare(
      `INSERT INTO bookings (offer_id, start, "end", name, email, phone, locale, created_at, cancel_token)
       VALUES (1, 1, 2, 'Ana', 'a@b.nl', '1', 'nl', 1, 'x')`,
    )
    .run();
  expect(runMigrations(sqlite, MIGRATIONS_FOLDER)).toBeGreaterThan(0);
  expect(sqlite.prepare("SELECT price_cents FROM bookings").get()).toEqual({ price_cents: 5500 });
  sqlite.close();
});
