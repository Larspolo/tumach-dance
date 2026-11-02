// The push of a device belongs to its login: the end of the login deletes the push (#586).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, expect, test, vi } from "vitest";
import { MIGRATIONS_FOLDER, openDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { pushSubscriptions, session, user } from "../src/db/schema";

const state = vi.hoisted(() => ({ db: undefined as unknown, sessionId: undefined as string | undefined }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("../src/lib/auth", () => ({
  getStudioSession: async () => (state.sessionId ? { session: { id: state.sessionId } } : null),
}));

const { saveSubscription } = await import("../src/lib/push");
const { POST } = await import("../src/app/api/studio/push/subscribe/route");

type Db = ReturnType<typeof openDb>;
const keys = { p256dh: "p", auth: "a" };

function addSession(db: Db, id: string) {
  const now = new Date();
  db.insert(user)
    .values({ id: "nina", name: "Nina", email: "nina@example.test", createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .run();
  db.insert(session)
    .values({ id, token: `token-${id}`, userId: "nina", expiresAt: now, createdAt: now, updatedAt: now })
    .run();
}

const endpoints = (db: Db) =>
  db
    .select()
    .from(pushSubscriptions)
    .all()
    .map((r) => r.endpoint)
    .sort();

test("the end of a login deletes its push; another push stays", async () => {
  const db = openDb(":memory:");
  addSession(db, "s1");
  addSession(db, "s2");
  saveSubscription(db, { endpoint: "https://push.example.test/1", keys }, 1, "en", "s1");
  saveSubscription(db, { endpoint: "https://push.example.test/2", keys }, 1, "en", "s2");
  saveSubscription(db, { endpoint: "https://push.example.test/old", keys }, 1, "en");
  const { eq } = await import("drizzle-orm");
  db.delete(session).where(eq(session.id, "s1")).run();
  expect(endpoints(db)).toEqual(["https://push.example.test/2", "https://push.example.test/old"]);
});

test("the POST stores the id of the session of the request", async () => {
  const db = openDb(":memory:");
  state.db = db;
  addSession(db, "s9");
  state.sessionId = "s9";
  const endpoint = "https://push.example.test/post";
  const response = await POST(
    new Request("http://localhost/api/studio/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint, keys }),
    }),
  );
  expect(response.status).toBe(200);
  expect(db.select().from(pushSubscriptions).get()?.sessionId).toBe("s9");
});

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("the migration keeps the push rows of before (session_id NULL)", () => {
  // The migrations of main before #586: the journal without its last entry.
  const dir = mkdtempSync(join(tmpdir(), "tumach-push-session-"));
  dirs.push(dir);
  cpSync(MIGRATIONS_FOLDER, dir, { recursive: true });
  const journalPath = join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  const last = journal.entries.at(-1)?.tag;
  expect(last).toMatch(/^0021_/);
  writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, -1) }));
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  runMigrations(sqlite, dir);
  sqlite
    .prepare("INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)")
    .run("https://push.example.test/before", "p", "a", 1);
  expect(runMigrations(sqlite, MIGRATIONS_FOLDER)).toBe(1);
  expect(sqlite.prepare("SELECT endpoint, session_id FROM push_subscriptions").all()).toEqual([
    { endpoint: "https://push.example.test/before", session_id: null },
  ]);
});
