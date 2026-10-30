// Server starts at the same instant on a new database: the WAL pragma waits for the lock (#180).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, expect, test } from "vitest";
import { MIGRATIONS_FOLDER } from "../src/db";
import { MIGRATIONS_TABLE } from "../src/db/migrate";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Each process waits until the same instant before the pragma: without the retry, about half of them got
// `SQLITE_BUSY` (CI of f5fb730 had one in four by chance).
const script = `
  import Database from "better-sqlite3";
  import { runMigrations } from ${JSON.stringify(join(process.cwd(), "src/db/migrate.ts"))};
  import { setWalMode } from ${JSON.stringify(join(process.cwd(), "src/db/wal.ts"))};
  const sqlite = new Database(process.argv[1], { timeout: 10000 });
  while (Date.now() < Number(process.argv[3]));
  setWalMode(sqlite);
  if (sqlite.pragma("journal_mode", { simple: true }) !== "wal") process.exit(2);
  runMigrations(sqlite, process.argv[2]);
`;

function startAll(path: string, count: number): Promise<(number | null)[]> {
  const at = String(Date.now() + 1500);
  return Promise.all(
    Array.from(
      { length: count },
      () =>
        new Promise<number | null>((resolve) => {
          const child = spawn(process.execPath, ["--input-type=module", "-e", script, path, MIGRATIONS_FOLDER, at], {
            stdio: "inherit",
          });
          child.on("exit", resolve);
        }),
    ),
  );
}

test("server starts at the same instant on a new database all set WAL mode and apply each migration once", async () => {
  for (let round = 0; round < 3; round++) {
    const dir = mkdtempSync(join(tmpdir(), "tumach-wal-"));
    dirs.push(dir);
    const path = join(dir, "tumach.db");
    expect(await startAll(path, 4)).toEqual([0, 0, 0, 0]);
    const sqlite = new Database(path);
    const count = sqlite.prepare(`SELECT count(*) AS n FROM "${MIGRATIONS_TABLE}"`).get() as { n: number };
    const files = (await import("drizzle-orm/migrator")).readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
    expect(count.n).toBe(files.length);
    sqlite.close();
  }
}, 60_000);
