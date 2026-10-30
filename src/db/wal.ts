// Set the WAL journal mode of a database (#180). Only type imports: `tests/db.test.ts` runs this file in plain Node
// processes.
import type Database from "better-sqlite3";

/**
 * Set `journal_mode = WAL`, and try again for up to `timeoutMs` while another connection locks the database.
 *
 * Own loop: the busy timeout of better-sqlite3 does not cover this pragma. On a new database the pragma reads the
 * file header and then needs a write lock; when two server starts do that at the same time, SQLite gives one of them
 * `SQLITE_BUSY` at once (it does not wait, to prevent a deadlock).
 */
export function setWalMode(sqlite: Database.Database, timeoutMs = 10_000): void {
  const end = Date.now() + timeoutMs;
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    try {
      sqlite.pragma("journal_mode = WAL");
      return;
    } catch (error) {
      if ((error as { code?: string }).code !== "SQLITE_BUSY" || Date.now() >= end) throw error;
      Atomics.wait(pause, 0, 0, 10);
    }
  }
}
