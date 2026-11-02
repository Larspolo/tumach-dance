// The health of the site for a check outside the home server (#261): the database answers a trivial query, and the
// newest nightly backup is at most 36 hours old (#262).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../db";
import { pushSubscriptions } from "../db/schema";
import { backupDir } from "./backup";
import { emailTransport } from "./email";

/** The backup runs each night from 03:00: 36 hours gives one missed night a margin of half a day. */
export const BACKUP_MAX_AGE_MS = 36 * 60 * 60_000;

/** The start of this server process: a new site has no backup before its first night. */
const SERVER_START = new Date();

const DB_BACKUP = /^tumach-\d{4}-\d{2}-\d{2}\.db$/;

/** `email`: the server can send email (`emailTransport()` does not throw). A production server with no keys cannot (#413). */
/** `push`: at least one device of Nina gets a push (#571). Only a boolean: no count, no endpoint. It does not change `ok`. */
export type HealthStatus = { ok: boolean; backupAt: string | null; email: boolean; push: boolean };

function emailReady(env: NodeJS.ProcessEnv): boolean {
  try {
    emailTransport(env);
    return true;
  } catch {
    return false;
  }
}

/** The instant of the newest database backup in `dir`, or `undefined` when there is none (or the folder cannot be read). */
export function newestBackup(dir: string): Date | undefined {
  try {
    let newest: number | undefined;
    for (const file of readdirSync(dir)) {
      if (!DB_BACKUP.test(file)) continue;
      const time = statSync(join(dir, file)).mtimeMs;
      if (newest === undefined || time > newest) newest = time;
    }
    return newest === undefined ? undefined : new Date(newest);
  } catch (error) {
    console.error("health: the backup folder cannot be read", error);
    return undefined;
  }
}

export function healthStatus(
  db: Db,
  {
    dir = backupDir(),
    now = new Date(),
    startedAt = SERVER_START,
    env = process.env,
  }: { dir?: string; now?: Date; startedAt?: Date; env?: NodeJS.ProcessEnv } = {},
): HealthStatus {
  const backup = newestBackup(dir);
  const backupOk = now.getTime() - (backup ?? startedAt).getTime() <= BACKUP_MAX_AGE_MS;
  const backupAt = backup ? backup.toISOString() : null;
  // No email call here: the check stays fast and free (#413).
  const email = emailReady(env);
  try {
    db.$client.prepare("select 1").get();
    const push = db.select({ endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions).limit(1).all().length > 0;
    return { ok: backupOk && email, backupAt, email, push };
  } catch (error) {
    console.error("health: the database does not answer", error);
    return { ok: false, backupAt, email, push: false };
  }
}
