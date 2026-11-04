// The studio app repairs the push of a device that the server lost (#570).
import { expect, type Page, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

// The full Chromium gives `Notification.permission` "granted" (#188, see push.spec.ts).
test.use({ storageState: STUDIO_SESSION, channel: "chromium" });

/** A fake PushManager: the browser has a subscription with this endpoint; `subscribe()` gives a new one. */
async function fakePush(page: Page, endpoint: string) {
  await page.addInitScript((old) => {
    const w = window as unknown as { pushLog: string[] };
    w.pushLog = [];
    const make = (url: string) =>
      ({
        endpoint: url,
        unsubscribe: async () => {
          w.pushLog.push(`unsubscribe ${url}`);
          return true;
        },
        toJSON: () => ({ endpoint: url, keys: { p256dh: "test-p256dh", auth: "test-auth" } }),
      }) as unknown as PushSubscription;
    PushManager.prototype.getSubscription = async () => make(old);
    PushManager.prototype.subscribe = async () => {
      w.pushLog.push("subscribe");
      return make(`${old}-new`);
    };
  }, endpoint);
}

const pushLog = (page: Page) => page.evaluate(() => (window as unknown as { pushLog: string[] }).pushLog);

test("a subscription that the server does not know is replaced and posted", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the phone project only");
  await context.grantPermissions(["notifications"]);
  const old = `https://push.example.test/lost-${Date.now()}`;
  await fakePush(page, old);
  const posted = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/studio/push/subscribe"));
  await page.goto("/studio/testing");
  expect((await posted).postDataJSON().endpoint).toBe(`${old}-new`);
  await expect(page.getByText(en.Push.on)).toBeVisible();
  expect(await pushLog(page)).toEqual([`unsubscribe ${old}`, "subscribe"]);
  const check = await page.request.get(`/api/studio/push/subscribe?endpoint=${encodeURIComponent(`${old}-new`)}`);
  expect(await check.json()).toEqual({ known: true });
});

test("a subscription that the server knows is not replaced", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the phone project only");
  await context.grantPermissions(["notifications"]);
  const known = `https://push.example.test/known-${Date.now()}`;
  const saved = await page.request.post("/api/studio/push/subscribe", {
    data: { endpoint: known, keys: { p256dh: "test-p256dh", auth: "test-auth" } },
  });
  expect(saved.ok()).toBe(true);
  await fakePush(page, known);
  await page.goto("/studio/testing");
  await expect(page.getByText(en.Push.on)).toBeVisible();
  expect(await pushLog(page)).toEqual([]);
});
