// A push goes only to a device with a live login (#605): no push to a row with no session or an expired session.
import { beforeEach, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { session, user } from "../src/db/schema";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));
const state = vi.hoisted(() => ({ db: undefined as unknown, sessionId: undefined as string | undefined }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("../src/lib/auth", () => ({
  getStudioSession: async () => (state.sessionId ? { session: { id: state.sessionId } } : null),
}));

const { saveSubscription, sendPush } = await import("../src/lib/push");
const { GET } = await import("../src/app/api/studio/push/subscribe/route");

type Db = ReturnType<typeof openDb>;
const keys = { p256dh: "p", auth: "a" };
const url = (n: string) => `https://push.example.test/${n}`;

function addSession(db: Db, id: string, expiresAt: Date) {
  const now = new Date();
  db.insert(user)
    .values({ id: "nina", name: "Nina", email: "nina@example.test", createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .run();
  db.insert(session)
    .values({ id, token: `t-${id}`, userId: "nina", expiresAt, createdAt: now, updatedAt: now })
    .run();
}

beforeEach(() => {
  sendNotification.mockReset();
  vi.stubEnv("VAPID_PUBLIC_KEY", "public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.test");
});

test("sendPush sends only to a row with a live session", async () => {
  const db = openDb(":memory:");
  addSession(db, "live", new Date(Date.now() + 3_600_000));
  addSession(db, "expired", new Date(Date.now() - 1000));
  saveSubscription(db, { endpoint: url("live"), keys }, 1, "en", "live");
  saveSubscription(db, { endpoint: url("expired"), keys }, 1, "en", "expired");
  saveSubscription(db, { endpoint: url("none"), keys }, 1, "en");
  sendNotification.mockResolvedValue({ statusCode: 201 });
  expect(await sendPush(db, { title: "T", body: "B" })).toBe(1);
  expect(sendNotification.mock.calls.map((c) => c[0].endpoint)).toEqual([url("live")]);
});

test("GET gives known only for the row of the session of the request", async () => {
  const db = openDb(":memory:");
  state.db = db;
  addSession(db, "s1", new Date(Date.now() + 3_600_000));
  addSession(db, "s2", new Date(Date.now() + 3_600_000));
  saveSubscription(db, { endpoint: url("mine"), keys }, 1, "en", "s1");
  saveSubscription(db, { endpoint: url("other"), keys }, 1, "en", "s2");
  saveSubscription(db, { endpoint: url("none"), keys }, 1, "en");
  state.sessionId = "s1";
  const ask = async (n: string) =>
    (await (await GET(new Request(`http://localhost/x?endpoint=${encodeURIComponent(url(n))}`))).json()).known;
  expect(await ask("mine")).toBe(true);
  expect(await ask("other")).toBe(false);
  expect(await ask("none")).toBe(false);
  state.sessionId = undefined;
  expect(await ask("mine")).toBe(false);
});
