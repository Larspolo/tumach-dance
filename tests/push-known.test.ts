// The studio app asks if the server still has the push of a device (#570).
import { expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { session, user } from "../src/db/schema";

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("../src/lib/auth", () => ({ getStudioSession: async () => ({ session: { id: "s1" } }) }));

const { hasSubscription, saveSubscription } = await import("../src/lib/push");
const { GET } = await import("../src/app/api/studio/push/subscribe/route");

const endpoint = "https://push.example.test/known";
const ask = (query: string) => GET(new Request(`http://localhost/api/studio/push/subscribe${query}`));

test("hasSubscription and GET give known for a stored device and unknown for another", async () => {
  const db = openDb(":memory:");
  state.db = db;
  const now = new Date();
  db.insert(user).values({ id: "nina", name: "Nina", email: "n@example.test", createdAt: now, updatedAt: now }).run();
  db.insert(session)
    .values({ id: "s1", token: "t", userId: "nina", expiresAt: now, createdAt: now, updatedAt: now })
    .run();
  saveSubscription(db, { endpoint, keys: { p256dh: "p", auth: "a" } }, 1, "en", "s1");
  expect(hasSubscription(db, endpoint, "s1")).toBe(true);
  expect(hasSubscription(db, "https://push.example.test/gone", "s1")).toBe(false);
  expect(await (await ask(`?endpoint=${encodeURIComponent(endpoint)}`)).json()).toEqual({ known: true });
  expect(await (await ask("?endpoint=https%3A%2F%2Fpush.example.test%2Fgone")).json()).toEqual({ known: false });
});

test("GET with no endpoint gives 400", async () => {
  state.db = openDb(":memory:");
  expect((await ask("")).status).toBe(400);
});
