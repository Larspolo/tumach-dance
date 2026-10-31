// The health of the nightly backup (#262): not ok when the newest backup is more than 36 hours old, or when a server
// that started more than 36 hours ago has no backup. The age is of instants: summer time does not move it.
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { healthStatus } from "../src/lib/health";

const HOUR = 60 * 60_000;
const NOW = new Date("2026-06-10T12:00:00Z");

let dir: string;
const db = openDb(":memory:");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tumach-health-backup-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function backupAt(at: Date, name = "tumach-2026-06-10.db") {
  const path = join(dir, name);
  writeFileSync(path, "");
  utimesSync(path, at, at);
}

const status = (now: Date, startedAt = new Date(now.getTime() - 100 * HOUR)) =>
  healthStatus(db, { dir, now, startedAt });

test("a backup of 10 hours ago is ok and names its instant", () => {
  backupAt(new Date(NOW.getTime() - 10 * HOUR));
  expect(status(NOW)).toEqual({ ok: true, backupAt: "2026-06-10T02:00:00.000Z" });
});

test("a backup of 37 hours ago is not ok; the newest file counts", () => {
  backupAt(new Date(NOW.getTime() - 37 * HOUR), "tumach-2026-06-08.db");
  expect(status(NOW).ok).toBe(false);
  backupAt(new Date(NOW.getTime() - 2 * HOUR), "tumach-2026-06-10.db");
  expect(status(NOW).ok).toBe(true);
});

test("other files in the folder are no backup", () => {
  backupAt(new Date(NOW.getTime() - HOUR), "tumach-2026-06-10.db.tmp");
  mkdirSync(join(dir, "photos"));
  expect(status(NOW)).toEqual({ ok: false, backupAt: null });
});

test("no backup is ok for a server that started 2 hours ago, not for one of 40 hours ago", () => {
  expect(status(NOW, new Date(NOW.getTime() - 2 * HOUR))).toEqual({ ok: true, backupAt: null });
  expect(status(NOW, new Date(NOW.getTime() - 40 * HOUR))).toEqual({ ok: false, backupAt: null });
});

test("a missing backup folder is no backup and one error line", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const missing = join(dir, "none");
  expect(healthStatus(db, { dir: missing, now: NOW, startedAt: new Date(NOW.getTime() - 40 * HOUR) })).toEqual({
    ok: false,
    backupAt: null,
  });
  expect(log).toHaveBeenCalledTimes(1);
});

test.each(["2026-10-25", "2026-03-29"])(
  "a backup of the night of %s (summer time changes) is ok 30 hours later",
  (night) => {
    const written = DateTime.fromISO(`${night}T03:00`, { zone: "Europe/Amsterdam" }).toJSDate();
    backupAt(written);
    const later = new Date(written.getTime() + 30 * HOUR);
    expect(status(later)).toEqual({ ok: true, backupAt: written.toISOString() });
    expect(status(new Date(written.getTime() + 37 * HOUR)).ok).toBe(false);
  },
);
