// The health address of the site (#261): the database answers, or the answer is 503.
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { getDb, openDb } from "../src/db";
import { healthStatus } from "../src/lib/health";

vi.mock("../src/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/db")>();
  return { ...original, getDb: vi.fn() };
});

// A fresh backup, so that only the database decides here (the backup: `health_backup.test.ts`).
let backups: string;
const BACKUP_AT = new Date();
BACKUP_AT.setMilliseconds(0);
beforeAll(() => {
  backups = mkdtempSync(join(tmpdir(), "tumach-health-"));
  writeFileSync(join(backups, "tumach-2026-10-31.db"), "");
  utimesSync(join(backups, "tumach-2026-10-31.db"), BACKUP_AT, BACKUP_AT);
  process.env.BACKUP_DIR = backups;
});
afterAll(() => {
  delete process.env.BACKUP_DIR;
  rmSync(backups, { recursive: true, force: true });
});

afterEach(() => {
  vi.mocked(getDb).mockReset();
  vi.restoreAllMocks();
});

test("the health of an open database is ok", () => {
  const db = openDb(":memory:");
  expect(healthStatus(db)).toEqual({ ok: true, backupAt: BACKUP_AT.toISOString() });
});

test("the health of a closed database is not ok and logs one line", () => {
  const db = openDb(":memory:");
  db.$client.close();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(healthStatus(db)).toEqual({ ok: false, backupAt: BACKUP_AT.toISOString() });
  expect(log).toHaveBeenCalledTimes(1);
});

test("the address answers 200 with ok and no-store", async () => {
  const { GET } = await import("../src/app/api/health/route");
  vi.mocked(getDb).mockReturnValue(openDb(":memory:"));
  const response = GET();
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(JSON.stringify({ ok: true, backupAt: BACKUP_AT.toISOString() }));
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

test("the address answers 503 when there is no database", async () => {
  const { GET } = await import("../src/app/api/health/route");
  vi.mocked(getDb).mockImplementation(() => {
    throw new Error("no database file");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = GET();
  expect(response.status).toBe(503);
  expect(await response.text()).toBe('{"ok":false,"backupAt":null}');
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
