// Nina is sick (#694, epic #690): she cancels all the coming bookings of one day from the week page in 2 taps.
// The bookings show as cancelled, the day is closed on the booking page, and a day with no booking has no link.

import { expect, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingDays } from "../src/lib/booking-page";
import { getHoursRule, saveHoursRule } from "../src/lib/hours-store";
import { weekOf } from "../src/lib/week";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("Nina cancels all the bookings of one day in 2 taps", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the cancel of a day is for the phone");
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4321, position: 96, visible: false });
  const free = bookingDays(db, offer).filter((day) => day.slots.length > 1);
  test.skip(free.length < 2, "the test needs open hours");
  // The last free day: other tests book the first days (#313); the close of this day must not take their times.
  const day = free[free.length - 1];
  const row = (name: string, status: "approved" | "requested", at: number) => ({
    offerId: offer.id,
    priceCents: offer.priceCents,
    start: at,
    end: at + 60 * 60_000,
    name,
    email: `${name.replace(" ", "-").toLowerCase()}-${Date.now()}@example.test`,
    phone: "",
    locale: "en",
    status,
    approvedAt: status === "approved" ? Date.now() : null,
    createdAt: Date.now(),
  });
  const before = getHoursRule(db);
  const added = db
    .insert(bookings)
    .values([
      row("Sick Approved", "approved", day.slots[day.slots.length - 1].start),
      row("Sick Asking", "requested", day.slots[day.slots.length - 2].start),
    ])
    .returning()
    .all();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/studio/week?start=${weekOf(day.date).start}`);
  const section = page.locator(`section[data-day="${day.date}"]`);
  await section.getByRole("link", { name: en.StudioWeek.cancelDay, exact: true }).click();
  await expect(section.locator("[data-cancel-day]")).toContainText(/Cancel \d+ bookings/);
  await page.screenshot({ path: "out/screenshots/studio-week-cancel-day-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-week-cancel-day-laptop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await section.getByRole("button", { name: en.StudioWeek.cancelDayYes }).click();

  await expect(page.locator("[data-day-cancelled]")).toContainText(/Cancelled \d+ bookings\./);
  const done = page.locator(`section[data-day="${day.date}"]`);
  await expect(done.locator("li", { hasText: "Sick Approved" })).toHaveCount(0);
  await expect(done.getByRole("link", { name: en.StudioWeek.cancelDay, exact: true })).toHaveCount(0);
  const rows = db
    .select({ status: bookings.status })
    .from(bookings)
    .where(
      inArray(
        bookings.id,
        added.map((b) => b.id),
      ),
    )
    .all();
  expect(rows.map((r) => r.status)).toEqual(["cancelled", "cancelled"]);
  expect(bookingDays(db, offer).some((d) => d.date === day.date && d.slots.length > 0)).toBe(false);
  // Open the day again: the later tests need its free times (studio-week-add-block.spec.ts).
  saveHoursRule(db, before);
});
