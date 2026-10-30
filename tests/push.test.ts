// Push notifications to the phone of Nina (#25): send to each device, delete a device that is gone.
import { NextRequest } from "next/server";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { pushSubscriptions } from "../src/db/schema";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));

const { saveSubscription, sendPush } = await import("../src/lib/push");

const sub = (n: number) => ({
  endpoint: `https://push.example.test/${n}`,
  keys: { p256dh: `key${n}`, auth: `auth${n}` },
});

beforeEach(() => {
  sendNotification.mockReset();
  vi.stubEnv("VAPID_PUBLIC_KEY", "public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.test");
});

afterAll(() => vi.unstubAllEnvs());

test("sendPush sends to each subscription and deletes a subscription that answers 410", async () => {
  const db = openDb(":memory:");
  for (const n of [1, 2, 3]) saveSubscription(db, sub(n));
  sendNotification.mockImplementation(async ({ endpoint }: { endpoint: string }) => {
    if (endpoint.endsWith("/2")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    return { statusCode: 201 };
  });
  expect(await sendPush(db, { title: "T", body: "B" })).toBe(2);
  expect(sendNotification).toHaveBeenCalledTimes(3);
  expect(sendNotification.mock.calls[0][0]).toEqual(sub(1));
  expect(JSON.parse(sendNotification.mock.calls[0][1])).toEqual({ title: "T", body: "B" });
  const left = db
    .select()
    .from(pushSubscriptions)
    .all()
    .map((r) => r.endpoint);
  expect(left).toEqual([sub(1).endpoint, sub(3).endpoint]);
});

test("a device that subscribes again replaces its row", () => {
  const db = openDb(":memory:");
  saveSubscription(db, sub(1), 1000);
  saveSubscription(db, { ...sub(1), keys: { p256dh: "new", auth: "new" } }, 2000);
  expect(db.select().from(pushSubscriptions).all()).toEqual([
    { endpoint: sub(1).endpoint, p256dh: "new", auth: "new", createdAt: 2000 },
  ]);
});

test("sendPush with no VAPID keys fails", async () => {
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  await expect(sendPush(openDb(":memory:"), { title: "T", body: "B" })).rejects.toThrow(/VAPID/);
});

test("the two push API routes answer 401 without a session of Nina", async () => {
  vi.stubEnv("DATABASE_PATH", ":memory:");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  const { default: proxy } = await import("../src/proxy");
  for (const path of ["/api/studio/push/subscribe", "/api/studio/push/test"]) {
    const request = new NextRequest(`http://localhost:3000${path}`, { method: "POST" });
    expect((await proxy(request)).status, path).toBe(401);
  }
});
