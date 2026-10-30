// Apply the migrations of `drizzle/` to a database (#14). Only package imports: `tests/db.test.ts` runs this file
// in plain Node processes.
import type Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";

export const MIGRATIONS_TABLE = "__drizzle_migrations";

/**
 * Apply the migrations that the database does not have yet, in one `BEGIN IMMEDIATE` transaction.
 *
 * Own loop, not `migrate()` of `drizzle-orm/better-sqlite3`: Drizzle reads the last applied migration before its
 * transaction starts, so two server starts at the same time can apply the same migration twice. The immediate
 * transaction takes the write lock before the read. The table is the one of Drizzle, so `drizzle-kit migrate` works too.
 */
export function runMigrations(sqlite: Database.Database, migrationsFolder: string): number {
  const migrations = readMigrationFiles({ migrationsFolder });
  const apply = sqlite.transaction((): number => {
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
    );
    const last = sqlite
      .prepare(`SELECT created_at FROM "${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1`)
      .get() as { created_at: number } | undefined;
    const insert = sqlite.prepare(`INSERT INTO "${MIGRATIONS_TABLE}" (hash, created_at) VALUES (?, ?)`);
    let applied = 0;
    for (const migration of migrations) {
      if (last && Number(last.created_at) >= migration.folderMillis) continue;
      for (const statement of migration.sql) sqlite.exec(statement);
      insert.run(migration.hash, migration.folderMillis);
      applied += 1;
    }
    return applied;
  });
  return apply.immediate();
}
