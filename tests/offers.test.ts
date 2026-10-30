// The offers of the studio (#30).
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { expect, test } from "vitest";
import { MIGRATIONS_FOLDER, openDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { addOffer, hideOffer, listOffers, updateOffer } from "../src/db/offers";

test("the migration runs on an empty database and on the database of #14, and keeps its data", () => {
  const empty = new Database(":memory:");
  runMigrations(empty, MIGRATIONS_FOLDER);
  expect(empty.prepare("SELECT name FROM sqlite_master WHERE name = 'offers'").get()).toBeTruthy();

  // The migrations folder of #14: only its first migration.
  const old = mkdtempSync(join(tmpdir(), "tumach-offers-"));
  try {
    mkdirSync(join(old, "meta"));
    const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.slice(0, 1);
    writeFileSync(join(old, "meta/_journal.json"), JSON.stringify(journal));
    copyFileSync(join(MIGRATIONS_FOLDER, `${journal.entries[0].tag}.sql`), join(old, `${journal.entries[0].tag}.sql`));
    const sqlite = new Database(":memory:");
    expect(runMigrations(sqlite, old)).toBe(1);
    sqlite.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('k', '1', 0)").run();
    expect(runMigrations(sqlite, MIGRATIONS_FOLDER)).toBeGreaterThan(0);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'offers'").get()).toBeTruthy();
    expect(sqlite.prepare("SELECT value FROM settings WHERE key = 'k'").get()).toEqual({ value: "1" });
  } finally {
    rmSync(old, { recursive: true, force: true });
  }
});

test("listOffers with visibleOnly gives the visible offers in the order of position", () => {
  const db = openDb(":memory:");
  const a = addOffer(db, { kind: "rental", minutes: 120, priceCents: 4000, position: 2 });
  addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 1 });
  const c = addOffer(db, { kind: "lesson", minutes: 90, priceCents: 8000, position: 0 });
  expect(a.visible).toBe(true);
  hideOffer(db, c.id);
  expect(listOffers(db, { visibleOnly: true }).map((o) => [o.kind, o.minutes])).toEqual([
    ["lesson", 60],
    ["rental", 120],
  ]);
  expect(listOffers(db).map((o) => o.minutes)).toEqual([90, 60, 120]);
  expect(updateOffer(db, a.id, { priceCents: 0 })?.priceCents).toBe(0);
});

test("an offer with minutes of 0 or less or a negative price is refused, also by the database", () => {
  const db = openDb(":memory:");
  expect(() => addOffer(db, { kind: "lesson", minutes: 0, priceCents: 100, position: 0 })).toThrow(RangeError);
  expect(() => addOffer(db, { kind: "lesson", minutes: -30, priceCents: 100, position: 0 })).toThrow(RangeError);
  expect(() => addOffer(db, { kind: "lesson", minutes: 60, priceCents: -1, position: 0 })).toThrow(RangeError);
  const { id } = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 100, position: 0 });
  expect(() => updateOffer(db, id, { minutes: 0 })).toThrow(RangeError);
  expect(() =>
    db.$client.prepare("INSERT INTO offers (kind, minutes, price_cents, position) VALUES ('lesson', 0, 1, 0)").run(),
  ).toThrow(/CHECK/);
  expect(() =>
    db.$client.prepare("INSERT INTO offers (kind, minutes, price_cents, position) VALUES ('lesson', 1, -1, 0)").run(),
  ).toThrow(/CHECK/);
  expect(listOffers(db)).toHaveLength(1);
});
