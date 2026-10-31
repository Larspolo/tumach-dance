// The nightly backup of the data (#247, roadmap `site:live`): the database and the photos, the last 14 nights. The
// backup of the database uses the online backup API of SQLite, so it is safe while the site writes.
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DateTime } from "luxon";
import type { Db } from "../db";
import { DEFAULT_DATABASE_PATH } from "../db";
import { photosDir } from "../db/photos";
import { TIME_ZONE } from "./hours";

export const BACKUP_KEEP_NIGHTS = 14;
/** The night starts at this hour (Amsterdam time): the backup is written at 03:00 or later. */
export const BACKUP_HOUR = 3;
export const BACKUP_CHECK_INTERVAL_MS = 60 * 60_000;

const DB_BACKUP = /^tumach-\d{4}-\d{2}-\d{2}\.db$/;

/** The folder of the backups: `BACKUP_DIR`, else `backups/` next to the database (the volume of the image). */
export function backupDir(): string {
  return process.env.BACKUP_DIR || join(dirname(process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH), "backups");
}

/**
 * Write the backup of the night of `now` (Amsterdam date), once per night, from 03:00. Returns the name of the new
 * database backup, or `undefined` when none was written. Photos are copied when they are missing; the database
 * backups older than the last 14 nights are removed.
 */
export async function backupData(db: Db, dir: string, photos: string, now: Date): Promise<string | undefined> {
  const local = DateTime.fromJSDate(now, { zone: TIME_ZONE });
  if (local.hour < BACKUP_HOUR) return undefined;
  mkdirSync(dir, { recursive: true });
  const name = `tumach-${local.toISODate()}.db`;
  const path = join(dir, name);
  let written: string | undefined;
  if (!existsSync(path)) {
    // A half file never has the name: write to a temporary name, then rename it.
    const tmp = `${path}.tmp`;
    rmSync(tmp, { force: true });
    await db.$client.backup(tmp);
    renameSync(tmp, path);
    written = name;
  }
  copyPhotos(photos, join(dir, "photos"));
  pruneBackups(dir);
  return written;
}

/** Copy each photo file that is not in the backup yet. The photo files never change: their names are random (`photos.ts`). */
function copyPhotos(source: string, target: string): void {
  if (!existsSync(source)) return;
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(source)) {
    const to = join(target, file);
    if (!existsSync(to)) copyFileSync(join(source, file), to);
  }
}

/** Remove the database backups older than the last 14 nights (the names sort by date). */
function pruneBackups(dir: string): void {
  const nights = readdirSync(dir)
    .filter((file) => DB_BACKUP.test(file))
    .sort()
    .reverse();
  for (const file of nights.slice(BACKUP_KEEP_NIGHTS)) rmSync(join(dir, file));
}

const timer = globalThis as unknown as { tumachBackupTimer?: NodeJS.Timeout };

/**
 * Start the nightly backup, once per process (the pattern of `startBookingTimer`). An error is logged once; the next
 * check tries again and the timer never stops the server.
 */
export function startBackupTimer(db: Db): NodeJS.Timeout {
  if (timer.tumachBackupTimer) return timer.tumachBackupTimer;
  let failing = false;
  const check = () =>
    backupData(db, backupDir(), photosDir(), new Date()).then(
      () => {
        failing = false;
      },
      (error) => {
        if (!failing) console.error("backup failed", error);
        failing = true;
      },
    );
  void check();
  timer.tumachBackupTimer = setInterval(check, BACKUP_CHECK_INTERVAL_MS);
  timer.tumachBackupTimer.unref();
  return timer.tumachBackupTimer;
}
