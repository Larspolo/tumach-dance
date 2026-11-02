// The studio app asks if the server still has the push of a device (#570).
import { expect, test, vi } from "vitest";
import { openDb } from "../src/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));

const { hasSubscription, saveSubscription } = await import("../src/lib/push");
const { GET } = await import("../src/app/api/studio/push/subscribe/route");

const endpoint = "https://push.example.test/known";
const ask = (query: string) => GET(new Request(`http://localhost/api/studio/push/subscribe${query}`));

test("hasSubscription and GET give known for a stored device and unknown for another", async () => {
  const db = openDb(":memory:");
  state.db = db;
  saveSubscription(db, { endpoint, keys: { p256dh: "p", auth: "a" } });
  expect(hasSubscription(db, endpoint)).toBe(true);
  expect(hasSubscription(db, "https://push.example.test/gone")).toBe(false);
  expect(await (await ask(`?endpoint=${encodeURIComponent(endpoint)}`)).json()).toEqual({ known: true });
  expect(await (await ask("?endpoint=https%3A%2F%2Fpush.example.test%2Fgone")).json()).toEqual({ known: false });
});

test("GET with no endpoint gives 400", async () => {
  state.db = openDb(":memory:");
  expect((await ask("")).status).toBe(400);
});
