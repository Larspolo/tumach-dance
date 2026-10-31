// The nightly backup (#247): the night of 03:00 Amsterdam time, one backup a night, the photos, the last 14 nights,
// and the summer time changes.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { settings } from "../src/db/schema";
import { backupData } from "../src/lib/backup";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toJSDate();

let dir: string;
let photos: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tumach-backup-"));
  photos = join(dir, "photos");
  mkdirSync(photos);
  writeFileSync(join(photos, "a1b2.webp"), "photo");
  db = openDb(join(dir, "data", "tumach.db"));
  db.insert(settings).values({ key: "greeting", value: "hallo", updatedAt: 1 }).run();
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const backups = (target: string) =>
  readdirSync(target)
    .filter((f) => f.endsWith(".db"))
    .sort();

test("a backup at 03:00 writes the database with the same rows, and a second call that night writes nothing", async () => {
  const target = join(dir, "backups");
  expect(await backupData(db, target, photos, at("2026-06-02T02:00"))).toBeUndefined();
  expect(existsSync(target)).toBe(false);

  expect(await backupData(db, target, photos, at("2026-06-02T03:00"))).toBe("tumach-2026-06-02.db");
  const copy = new Database(join(target, "tumach-2026-06-02.db"), { readonly: true });
  expect(copy.prepare("SELECT value FROM settings WHERE key = 'greeting'").get()).toEqual({ value: "hallo" });
  copy.close();

  expect(await backupData(db, target, photos, at("2026-06-02T09:00"))).toBeUndefined();
  expect(backups(target)).toEqual(["tumach-2026-06-02.db"]);
});

test("the 15th night removes the oldest backup", async () => {
  const target = join(dir, "backups");
  const start = DateTime.fromISO("2026-06-01T03:00", { zone: "Europe/Amsterdam" });
  for (let night = 0; night < 15; night++) {
    await backupData(db, target, photos, start.plus({ days: night }).toJSDate());
  }
  const names = backups(target).filter((f) => f.endsWith(".db"));
  expect(names).toHaveLength(14);
  expect(names).not.toContain("tumach-2026-06-01.db");
  expect(names).toContain("tumach-2026-06-15.db");
});

test("a photo is copied once: the backup keeps its copy", async () => {
  const target = join(dir, "backups");
  await backupData(db, target, photos, at("2026-06-02T03:00"));
  expect(readFileSync(join(target, "photos", "a1b2.webp"), "utf8")).toBe("photo");

  writeFileSync(join(target, "photos", "a1b2.webp"), "kept");
  writeFileSync(join(photos, "c3d4.webp"), "new");
  await backupData(db, target, photos, at("2026-06-03T03:00"));
  expect(readFileSync(join(target, "photos", "a1b2.webp"), "utf8")).toBe("kept");
  expect(readFileSync(join(target, "photos", "c3d4.webp"), "utf8")).toBe("new");
});

test.each([
  ["2026-03-29T03:30", "tumach-2026-03-29.db"],
  ["2026-10-25T03:30", "tumach-2026-10-25.db"],
])("the night of %s (summer time change) is named by its Amsterdam date", async (local, name) => {
  const target = join(dir, "backups");
  expect(await backupData(db, target, photos, at(local))).toBe(name);
});
