// Nina cancels a booking from the week page on a phone in two taps (#162); the dancer gets the cancel email.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("Nina cancels an approved booking in two taps", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the week is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "rental", minutes: 60, priceCents: 4000, position: 94 });
  // A Thursday far in the future: no other test books it.
  const start = DateTime.fromISO("2032-03-11T15:00", { zone: TIME_ZONE });
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      name: "Cancel Dancer",
      email: "cancel-dancer@example.test",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      createdAt: Date.now(),
    })
    .returning()
    .get();

  await page.goto("/studio/week?start=2032-03-11");
  const day = page.locator('section[data-day="2032-03-11"]');
  await expect(day.getByText("Cancel Dancer")).toBeVisible();
  await day.getByRole("link", { name: en.StudioWeek.cancel, exact: true }).click();
  await expect(day.getByText(en.StudioWeek.cancelAsk)).toBeVisible();
  await page.screenshot({ path: "out/screenshots/studio-week-cancel-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-week-cancel-laptop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await day.getByRole("button", { name: en.StudioWeek.cancelYes }).click();

  await expect(page).toHaveURL(/\/studio\/week\?start=2032-03-08$/);
  await expect(page.getByText("Cancel Dancer")).toHaveCount(0);
  const row = db.select().from(bookings).where(eq(bookings.id, booking.id)).get();
  expect(row?.status).toBe("cancelled");
  await expect.poll(() => readFileSync("out/e2e/email.log", "utf8")).toContain("cancel-dancer@example.test");
});
