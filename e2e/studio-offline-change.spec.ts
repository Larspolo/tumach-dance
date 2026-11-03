// With no internet, a change in the studio app is stopped and says why (#748).
import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION, viewport: { width: 390, height: 844 } });

async function request(page: Page, name: string) {
  await page.goto("/en/book");
  await page
    .getByRole("link", { name: /€43\.48/ })
    .first()
    .click();
  await page.locator("section", { hasText: en.Book.day }).getByRole("link").first().click();
  await page.locator("section", { hasText: en.Book.time }).getByRole("link").first().click();
  await page.getByLabel(en.Book.name).fill(name);
  await page.getByLabel(en.Book.email).fill("offline@example.test");
  await page.getByLabel(en.Book.phone).fill("+31 6 1234 5678");
  await page.getByRole("button", { name: en.Book.send }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
}

for (const [lang, m] of [
  ["en", en],
  ["nl", nl],
] as const) {
  test(`with no internet Approve and Save change nothing (${lang})`, async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
    const db = openDb("out/e2e/tumach.db");
    // An unusual price finds the offer of this test; the second language finds the offer of the first.
    if (lang === "en") addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4348, position: 93 });
    const name = `Offline ${lang}`;
    await request(page, name);
    await page.evaluate((l) => {
      // biome-ignore lint/suspicious/noDocumentCookie: the same plain cookie as the language control sets.
      document.cookie = `NEXT_LOCALE=${l}; path=/`;
    }, lang);

    await page.goto("/studio/bookings");
    const item = page.getByRole("list").first().locator("li", { hasText: name });
    await context.setOffline(true);
    await item.getByRole("button", { name: m.StudioBookings.approve }).click();
    await expect(page.getByRole("alert").filter({ hasText: m.StudioHome.needsInternet })).toBeVisible();
    await page.screenshot({ path: `out/screenshots/studio-offline-change-${lang}.png` });
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByRole("list").first().locator("li", { hasText: name })).toHaveCount(1);
    expect(db.select().from(bookings).where(eq(bookings.name, name)).get()?.status).toBe("requested");

    await page.goto("/studio/hours");
    await context.setOffline(true);
    await page.getByRole("button", { name: m.StudioHours.save }).click();
    await expect(page.getByRole("alert").filter({ hasText: m.StudioHome.needsInternet })).toBeVisible();
    await expect(page.getByText(m.StudioHours.saved)).toHaveCount(0);
    await context.setOffline(false);
  });
}
