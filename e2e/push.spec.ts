// Push notifications of the studio app (#25): Nina turns them on, and the server stores the subscription.
import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

// The headless shell of Playwright (the default) gives `Notification.permission` "denied" also after
// `grantPermissions`, so the page shows "blocked" (#188). The full Chromium in headless mode gives "granted".
test.use({ storageState: STUDIO_SESSION, channel: "chromium" });

function subscriptions(): number {
  const db = new Database("out/e2e/tumach.db", { readonly: true });
  try {
    return (db.prepare("SELECT count(*) AS n FROM push_subscriptions").get() as { n: number }).n;
  } finally {
    db.close();
  }
}

test("Nina turns on notifications and the server stores her phone", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "the laptop project only");
  await context.grantPermissions(["notifications"]);
  // Headless Chromium has no push service (FCM): a fake subscription stands in for its answer. The permission, the
  // service worker, the API route and the database are real.
  await page.addInitScript(() => {
    PushManager.prototype.subscribe = async () =>
      ({
        toJSON: () => ({
          endpoint: `https://push.example.test/${Date.now()}`,
          keys: { p256dh: "test-p256dh", auth: "test-auth" },
        }),
      }) as unknown as PushSubscription;
  });
  await page.goto("/studio");

  const before = subscriptions();
  await page.getByRole("button", { name: en.Push.turnOn }).click();
  await expect(page.getByText(en.Push.on)).toBeVisible();
  expect(subscriptions()).toBe(before + 1);
  await expect(page.getByRole("button", { name: en.Push.sendTest })).toBeVisible();
  await page.screenshot({ path: "out/screenshots/studio-push.png", fullPage: true });
});
