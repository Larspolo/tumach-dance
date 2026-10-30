// The bookings of a week in the studio app on a phone (#102): a request on its day, the previous and next week.
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test("without a session the week page goes to the login page", async ({ page }) => {
  await page.goto("/studio/week");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test.describe("with a session", () => {
  test.use({ storageState: STUDIO_SESSION });

  test("a request shows on its day, and the week changes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the week is for the phone");
    const db = openDb("out/e2e/tumach.db");
    const offer = addOffer(db, { kind: "rental", minutes: 90, priceCents: 5117, position: 93 });
    // A Wednesday far in the future: no other test books it.
    const start = DateTime.fromISO("2031-06-11T14:00", { zone: TIME_ZONE });
    db.insert(bookings)
      .values({
        offerId: offer.id,
        start: start.toMillis(),
        end: start.plus({ minutes: 90 }).toMillis(),
        name: "Week Dancer",
        email: "dancer@example.test",
        phone: "+31 6 1234 5678",
        locale: "en",
        status: "requested",
        createdAt: Date.now(),
      })
      .run();

    await page.goto("/studio");
    await page.getByRole("link", { name: en.StudioHome.week }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioWeek.title);

    await page.goto("/studio/week?start=2031-06-11");
    const day = page.locator('section[data-day="2031-06-11"]');
    await expect(day.getByText("Week Dancer")).toBeVisible();
    await expect(day.getByRole("link", { name: en.StudioWeek.request })).toHaveAttribute("href", "/studio/bookings");
    await expect(page.locator('section[data-day="2031-06-09"]')).toContainText(en.StudioWeek.free);
    await page.screenshot({ path: "out/screenshots/studio-week-phone.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-week-laptop.png", fullPage: true });

    await page.getByRole("link", { name: en.StudioWeek.next }).click();
    await expect(page.locator('section[data-day="2031-06-16"]')).toBeVisible();
    await expect(page.getByText("Week Dancer")).toHaveCount(0);
    await page.getByRole("link", { name: en.StudioWeek.previous }).click();
    await page.getByRole("link", { name: en.StudioWeek.previous }).click();
    await expect(page.locator('section[data-day="2031-06-02"]')).toBeVisible();
  });
});
