// The database and its migrations (#14).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { MIGRATIONS_FOLDER, openDb } from "../src/db";
import { MIGRATIONS_TABLE, runMigrations } from "../src/db/migrate";
import { settings } from "../src/db/schema";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "tumach-db-"));
  dirs.push(dir);
  return dir;
}

function schemaOf(sqlite: Database.Database): unknown[] {
  return sqlite.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY name").all();
}

test("the migrations run on an empty in-memory database, and a second run changes nothing", () => {
  const sqlite = new Database(":memory:");
  expect(runMigrations(sqlite, MIGRATIONS_FOLDER)).toBeGreaterThan(0);
  const schema = schemaOf(sqlite);
  const rows = sqlite.prepare(`SELECT * FROM "${MIGRATIONS_TABLE}"`).all();
  expect(runMigrations(sqlite, MIGRATIONS_FOLDER)).toBe(0);
  expect(schemaOf(sqlite)).toEqual(schema);
  expect(sqlite.prepare(`SELECT * FROM "${MIGRATIONS_TABLE}"`).all()).toEqual(rows);
});

test("openDb gives a typed database with foreign keys on", () => {
  const db = openDb(":memory:");
  db.insert(settings)
    .values({ key: "k", value: '"v"', updatedAt: Date.UTC(2026, 9, 25, 1, 30) })
    .run();
  expect(db.select().from(settings).where(eq(settings.key, "k")).get()?.updatedAt).toBe(Date.UTC(2026, 9, 25, 1, 30));
  expect(db.$client.pragma("foreign_keys", { simple: true })).toBe(1);
});

test("openDb creates the file and its folder, in WAL mode", () => {
  const path = join(tempDir(), "data", "tumach.db");
  const db = openDb(path);
  expect(existsSync(path)).toBe(true);
  expect(db.$client.pragma("journal_mode", { simple: true })).toBe("wal");
  db.$client.close();
});

test("four server starts at the same time apply each migration once", async () => {
  const path = join(tempDir(), "tumach.db");
  const script = `
    import Database from "better-sqlite3";
    import { runMigrations } from ${JSON.stringify(join(process.cwd(), "src/db/migrate.ts"))};
    const sqlite = new Database(process.argv[1], { timeout: 10000 });
    sqlite.pragma("journal_mode = WAL");
    runMigrations(sqlite, process.argv[2]);
  `;
  const start = () =>
    new Promise<number | null>((resolve) => {
      const child = spawn(process.execPath, ["--input-type=module", "-e", script, path, MIGRATIONS_FOLDER], {
        stdio: "inherit",
      });
      child.on("exit", resolve);
    });
  expect(await Promise.all([start(), start(), start(), start()])).toEqual([0, 0, 0, 0]);
  const sqlite = new Database(path);
  const count = sqlite.prepare(`SELECT count(*) AS n FROM "${MIGRATIONS_TABLE}"`).get() as { n: number };
  const files = (await import("drizzle-orm/migrator")).readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  expect(count.n).toBe(files.length);
  sqlite.close();
}, 30_000);
