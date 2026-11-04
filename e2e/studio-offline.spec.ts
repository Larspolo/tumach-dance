// With no internet, the studio app shows the last studio home with the lessons of today and tomorrow (#746, epic #745).
// After "Log out", no studio home stays on the phone.
import { readFileSync } from "node:fs";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
});

function lesson(db: ReturnType<typeof openDb>, offerId: number, start: DateTime, name: string) {
  return db
    .insert(bookings)
    .values({
      offerId,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      priceCents: 5000,
      name,
      email: "dancer@example.test",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      createdAt: Date.now(),
      paidAt: null,
    })
    .returning({ id: bookings.id })
    .get();
}

/** Open the studio home until the service worker controls it (its activation keeps the home first). */
async function openControlled(page: Page) {
  await page.goto("/studio");
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, { timeout: 15_000 });
}

async function offlineReload(context: BrowserContext, page: Page) {
  await context.setOffline(true);
  await page.reload();
}

test.describe("with the shared session", () => {
  test.use({ storageState: STUDIO_SESSION });

  for (const [locale, texts] of [
    ["en-GB", en],
    ["nl-NL", nl],
  ] as const) {
    test.describe(locale, () => {
      test.use({ locale });

      test("the studio home with no internet shows the lessons of today and tomorrow", async ({ page, context }) => {
        const db = openDb("out/e2e/tumach.db");
        const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 746 });
        const startOfToday = DateTime.now().setZone(TIME_ZONE).startOf("day");
        const stamp = Date.now();
        const todayName = `Offline today ${stamp}`;
        const tomorrowName = `Offline tomorrow ${stamp}`;
        const a = lesson(db, offer.id, startOfToday.set({ hour: 23 }), todayName);
        const b = lesson(db, offer.id, startOfToday.plus({ days: 1 }).set({ hour: 10 }), tomorrowName);
        try {
          await openControlled(page);
          // A second open with internet: the worker keeps this page (network first).
          await page.reload();
          await expect(page.getByRole("link", { name: todayName })).toBeVisible();
          await offlineReload(context, page);
          await expect(page.getByRole("heading", { name: texts.StudioHome.today, exact: true })).toBeVisible();
          await expect(page.getByRole("link", { name: todayName })).toBeVisible();
          await expect(page.getByRole("link", { name: tomorrowName })).toBeVisible();
          await page.screenshot({ path: `out/screenshots/studio-offline-phone-${locale}.png`, fullPage: true });
        } finally {
          await context.setOffline(false);
          db.delete(bookings)
            .where(inArray(bookings.id, [a.id, b.id]))
            .run();
        }
      });
    });
  }

  test("the login page deletes the kept studio home", async ({ page, context }) => {
    await openControlled(page);
    expect(await page.evaluate(async () => (await caches.keys()).includes("studio-v1"))).toBe(true);
    // The login page (also the target of the redirect of an ended session) deletes it. It does not log out.
    await page.goto("/studio/login");
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("studio-v1"))).toBe(false);
    await offlineReload(context, page).catch(() => {});
    await expect(page.getByRole("link", { name: /Offline today/ })).toHaveCount(0);
    await context.setOffline(false);
  });
});

// "Log out" ends the session: a new login of its own (as studio-devices-logout.spec.ts), never the shared session.
const EMAIL_LOG = "out/e2e/email.log";
function lastCode(): string | undefined {
  const lines = readFileSync(EMAIL_LOG, "utf8").trim().split("\n");
  return JSON.parse(lines.at(-1) ?? "{}").text?.match(/\b\d{6}\b/)?.[0];
}

test.describe("with an own session", () => {
  // Better Auth allows 3 codes a minute per IP address: an own address for this login.
  test.use({ extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${(Date.now() % 200) + 1}` } });

  test("after Log out, the studio home is not kept", async ({ page, context }) => {
    await page.goto("/studio/login");
    const before = lastCode();
    await page.getByLabel(en.StudioLogin.emailLabel).fill("nina@example.test");
    await page.getByRole("button", { name: en.StudioLogin.sendCode }).click();
    await expect(page.getByLabel(en.StudioLogin.codeLabel)).toBeVisible();
    await expect.poll(() => lastCode()).not.toBe(before);
    await page.getByLabel(en.StudioLogin.codeLabel).fill(lastCode() ?? "");
    await page.getByRole("button", { name: en.StudioLogin.logIn }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await openControlled(page);
    expect(await page.evaluate(async () => (await caches.keys()).includes("studio-v1"))).toBe(true);

    await page.getByRole("button", { name: en.StudioHome.logOut }).click();
    await expect(page).toHaveURL(/\/studio\/login$/);
    expect(await page.evaluate(async () => (await caches.keys()).includes("studio-v1"))).toBe(false);
    await context.setOffline(true);
    // No kept page: the browser shows its own error page.
    await expect(page.goto("/studio")).rejects.toThrow();
    await context.setOffline(false);
  });
});
