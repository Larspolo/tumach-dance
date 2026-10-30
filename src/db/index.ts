// The one database connection of the server (#14): SQLite in the file of `DATABASE_PATH` on the home server.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { runMigrations } from "./migrate";
import * as schema from "./schema";
import { setWalMode } from "./wal";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** The development default. The image sets `/data/tumach.db` (the volume). */
export const DEFAULT_DATABASE_PATH = "./data/tumach.db";
export const MIGRATIONS_FOLDER = join(process.cwd(), "drizzle");

/** Open a database with the settings of the site and apply the migrations. `:memory:` for tests. */
export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { timeout: 10_000 });
  setWalMode(sqlite);
  sqlite.pragma("foreign_keys = ON");
  runMigrations(sqlite, MIGRATIONS_FOLDER);
  return drizzle(sqlite, { schema });
}

// On globalThis, so that a reload of the development server keeps one connection.
const cache = globalThis as unknown as { tumachDb?: Db };

/** The database of the server. The first call opens it (not at import: `next build` must not create the file). */
export function getDb(): Db {
  cache.tumachDb ??= openDb(process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH);
  return cache.tumachDb;
}
