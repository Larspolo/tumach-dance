// The restore of one night (#248): the backup of `backupData()` opens with the same booking and photo.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, test } from "vitest";
// @ts-expect-error a plain script with no types
import { restoreData } from "../scripts/restore.mjs";
import { openDb } from "../src/db";
import { bookings, offers } from "../src/db/schema";
import { backupData } from "../src/lib/backup";

const NIGHT = DateTime.fromISO("2026-11-01T03:30", { zone: "Europe/Amsterdam" }).toJSDate();

let dir: string;
let backups: string;

function addBooking(path: string, name: string) {
  const db = openDb(path);
  const offer = db
    .insert(offers)
    .values({ kind: "lesson", minutes: 60, priceCents: 5000, position: 1 })
    .returning()
    .get();
  db.insert(bookings)
    .values({ offerId: offer.id, start: 1, end: 2, name, email: "a@b.nl", phone: "1", locale: "nl", createdAt: 1 })
    .run();
  return db;
}

const names = (path: string) => {
  const db = openDb(path);
  const rows = db
    .select()
    .from(bookings)
    .all()
    .map((b) => b.name);
  db.$client.close();
  return rows;
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "tumach-restore-"));
  backups = join(dir, "backups");
  const photos = join(dir, "photos");
  mkdirSync(photos);
  writeFileSync(join(photos, "a1b2.webp"), "photo");
  const db = addBooking(join(dir, "data", "tumach.db"), "Ana");
  await backupData(db, backups, photos, NIGHT);
  db.$client.close();
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("a restore into an empty folder opens with the same booking and photo", () => {
  const target = join(dir, "new");
  restoreData({
    backupDir: backups,
    dataPath: join(target, "tumach.db"),
    photosDir: join(target, "photos"),
    date: "2026-11-01",
  });
  expect(names(join(target, "tumach.db"))).toEqual(["Ana"]);
  expect(existsSync(join(target, "photos", "a1b2.webp"))).toBe(true);
});

test("a restore of a missing date throws, lists the dates and changes nothing", () => {
  const target = join(dir, "new");
  expect(() =>
    restoreData({
      backupDir: backups,
      dataPath: join(target, "tumach.db"),
      photosDir: join(target, "photos"),
      date: "2026-10-30",
    }),
  ).toThrow(/2026-11-01/);
  expect(existsSync(target)).toBe(false);
});

test("a restore over a database with a -wal file gives the data of the backup", () => {
  const target = join(dir, "live");
  const path = join(target, "tumach.db");
  const db = addBooking(path, "Old");
  // The newest rows are only in the -wal file (no checkpoint): keep a copy of it, as a stopped site can leave it.
  db.$client.pragma("wal_autocheckpoint = 0");
  addBooking(path, "Newer").$client.close();
  copyFileSync(`${path}-wal`, `${path}.wal-copy`);
  db.$client.close();
  renameSync(`${path}.wal-copy`, `${path}-wal`);
  restoreData({ backupDir: backups, dataPath: path, photosDir: join(target, "photos"), date: "2026-11-01" });
  expect(existsSync(`${path}-wal`)).toBe(false);
  expect(names(path)).toEqual(["Ana"]);
  expect(readdirSync(join(target, "photos"))).toEqual(["a1b2.webp"]);
});
