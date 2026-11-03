// The studio home page shows at the top when the phone gets no push (#580).
import { expect, type Page, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

// The full Chromium gives `Notification.permission` "granted" (#188, see push.spec.ts).
test.use({ storageState: STUDIO_SESSION, channel: "chromium" });

/** A fake PushManager: `getSubscription()` gives this endpoint (or none); `subscribe()` gives a new one. */
async function fakePush(page: Page, endpoint: string | null, fresh: string) {
  await page.addInitScript(
    ([old, next]) => {
      const make = (url: string) =>
        ({
          endpoint: url,
          unsubscribe: async () => true,
          toJSON: () => ({ endpoint: url, keys: { p256dh: "test-p256dh", auth: "test-auth" } }),
        }) as unknown as PushSubscription;
      let current = old ? make(old) : null;
      PushManager.prototype.getSubscription = async () => current;
      PushManager.prototype.subscribe = async () => {
        current = make(next as string);
        return current;
      };
    },
    [endpoint, fresh],
  );
}

test("no subscription: the note and the button are at the top", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the phone project only");
  await context.grantPermissions(["notifications"]);
  const fresh = `https://push.example.test/alert-${Date.now()}`;
  await fakePush(page, null, fresh);
  await page.goto("/studio");
  const note = page.getByText(en.Push.offNote);
  const button = page.getByRole("button", { name: en.Push.turnOn });
  await expect(note).toBeVisible();
  await expect(button).toBeVisible();
  const buttonBox = await button.boundingBox();
  const noteBox = await note.boundingBox();
  const tileBox = await page.getByRole("link", { name: new RegExp(`^${en.StudioHome.bookings}`) }).boundingBox();
  expect(buttonBox && noteBox && tileBox).toBeTruthy();
  if (!buttonBox || !noteBox || !tileBox) return;
  expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(844);
  expect(noteBox.y).toBeLessThan(tileBox.y);
  expect(buttonBox.y).toBeLessThan(tileBox.y);
  const posted = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/studio/push/subscribe"));
  await button.click();
  expect((await posted).postDataJSON().endpoint).toBe(fresh);
  await expect(page.getByText(en.Push.on)).toBeVisible();
  await expect(note).toHaveCount(0);
});

test("a subscription that the server knows: no note", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the phone project only");
  await context.grantPermissions(["notifications"]);
  const known = `https://push.example.test/alert-known-${Date.now()}`;
  const saved = await page.request.post("/api/studio/push/subscribe", {
    data: { endpoint: known, keys: { p256dh: "test-p256dh", auth: "test-auth" } },
  });
  expect(saved.ok()).toBe(true);
  await fakePush(page, known, `${known}-new`);
  await page.goto("/studio");
  await expect(page.getByText(en.Push.on)).toBeVisible();
  await expect(page.getByText(en.Push.offNote)).toHaveCount(0);
});
