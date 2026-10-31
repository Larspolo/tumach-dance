// Restore the data of one night (#248, roadmap `site:live`): the database backup of that date and the missing photos.
// A plain Node script with built-ins only: the image runs the standalone build, with no TypeScript.
// Use: stop the site, then `node scripts/restore.mjs 2026-11-01`, then start the site.
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The defaults of `src/db/index.ts`, `src/lib/backup.ts` and `src/db/photos.ts`.
const DEFAULT_DATABASE_PATH = "./data/tumach.db";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DB_BACKUP = /^tumach-(\d{4}-\d{2}-\d{2})\.db$/;

/** The dates of the database backups in `backupDir`, oldest first. */
export function backupDates(backupDir) {
  if (!existsSync(backupDir)) return [];
  return readdirSync(backupDir)
    .map((file) => DB_BACKUP.exec(file)?.[1])
    .filter(Boolean)
    .sort();
}

/**
 * Copy `<backupDir>/tumach-<date>.db` to `dataPath`, remove its old `-wal` and `-shm` files, and copy the photo files
 * of the backup that are missing in `photosDir`. Throws, and changes nothing, when that backup is missing.
 */
export function restoreData({ backupDir, dataPath, photosDir, date }) {
  const source = join(backupDir, `tumach-${date}.db`);
  if (!DATE.test(date) || !existsSync(source)) {
    const dates = backupDates(backupDir);
    throw new Error(`No backup of ${date} in ${backupDir}. Backups: ${dates.length > 0 ? dates.join(", ") : "none"}`);
  }
  mkdirSync(dirname(dataPath), { recursive: true });
  // A half file never has the name of the database: copy to a temporary name, then rename it.
  const tmp = `${dataPath}.restore`;
  copyFileSync(source, tmp);
  rmSync(`${dataPath}-wal`, { force: true });
  rmSync(`${dataPath}-shm`, { force: true });
  renameSync(tmp, dataPath);
  const photos = join(backupDir, "photos");
  if (existsSync(photos)) {
    mkdirSync(photosDir, { recursive: true });
    for (const file of readdirSync(photos)) {
      const to = join(photosDir, file);
      if (!existsSync(to)) copyFileSync(join(photos, file), to);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const date = process.argv[2];
  const dataPath = process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH;
  const backupDir = process.env.BACKUP_DIR || join(dirname(dataPath), "backups");
  const photosDir = process.env.PHOTOS_DIR || join(dirname(dataPath), "photos");
  if (!date) {
    console.error(`Use: node scripts/restore.mjs <date>. Backups: ${backupDates(backupDir).join(", ") || "none"}`);
    process.exit(1);
  }
  try {
    restoreData({ backupDir, dataPath, photosDir, date });
    console.log(`Restored the data of ${date} to ${dataPath}.`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
