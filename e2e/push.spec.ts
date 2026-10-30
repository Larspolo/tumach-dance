// Push notifications of the studio app (#25): Nina turns them on, and the server stores the subscription.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import en from "../messages/en.json" with { type: "json" };

const EMAIL = "nina@example.test";
const EMAIL_LOG = "out/e2e/email.log";

function lastCode(): string | undefined {
  const lines = readFileSync(EMAIL_LOG, "utf8").trim().split("\n");
  return JSON.parse(lines.at(-1) ?? "{}").text?.match(/\b\d{6}\b/)?.[0];
}

function subscriptions(): number {
  const db = new Database("out/e2e/tumach.db", { readonly: true });
  try {
    return (db.prepare("SELECT count(*) AS n FROM push_subscriptions").get() as { n: number }).n;
  } finally {
    db.close();
  }
}

test("Nina turns on notifications and the server stores her phone", async ({ page, context }, testInfo) => {
  // One login at a time: the login test runs on the phone project, this one on the laptop project.
  test.skip(testInfo.project.name !== "laptop", "one login at a time");
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
  await page.getByLabel(en.StudioLogin.emailLabel).fill(EMAIL);
  await page.getByRole("button", { name: en.StudioLogin.sendCode }).click();
  await expect(page.getByLabel(en.StudioLogin.codeLabel)).toBeVisible();
  await expect.poll(() => lastCode()).toBeTruthy();
  await page.getByLabel(en.StudioLogin.codeLabel).fill(lastCode() ?? "");
  await page.getByRole("button", { name: en.StudioLogin.logIn }).click();
  await expect(page).toHaveURL(/\/studio$/);

  const before = subscriptions();
  await page.getByRole("button", { name: en.Push.turnOn }).click();
  await expect(page.getByText(en.Push.on)).toBeVisible();
  expect(subscriptions()).toBe(before + 1);
  await expect(page.getByRole("button", { name: en.Push.sendTest })).toBeVisible();
  await page.screenshot({ path: "out/screenshots/studio-push.png", fullPage: true });
});
