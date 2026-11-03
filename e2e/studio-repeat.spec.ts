// Nina repeats an approved booking from the week page on her phone (#679): "Repeat", keep 4 weeks, tap Repeat (2 taps).
// The next week shows the new lesson, a week with a block is named as not free, and a requested booking has no Repeat.
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addBlock } from "../src/db/blocks";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingDays } from "../src/lib/booking-page";
import { TIME_ZONE } from "../src/lib/hours";
import { localDate, weekOf } from "../src/lib/week";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("Nina repeats an approved booking for 4 weeks and sees the week that was not free", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the repeat is for the phone");
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4321, position: 95, visible: false });
  const free = bookingDays(db, offer).filter((day) => day.slots.length > 1);
  test.skip(free.length < 2, "the test needs open hours");
  // The last free time of the second free day: other tests book the first times (#313).
  const day = free[1];
  const slot = day.slots[day.slots.length - 1];
  const start = DateTime.fromMillis(slot.start, { zone: TIME_ZONE });
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
  db.insert(bookings)
    .values(row("Repeat Dancer", "approved", slot.start))
    .run();
  db.insert(bookings)
    .values(row("Asking Dancer", "requested", day.slots[0].start))
    .run();
  // Nina keeps the time of the third week free.
  const blocked = start.plus({ weeks: 2 });
  addBlock(db, { start: blocked.toMillis(), end: blocked.plus({ hours: 1 }).toMillis() });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/studio/week?start=${weekOf(day.date).start}`);
  const asking = page.locator("li", { hasText: "Asking Dancer" });
  await expect(asking.getByRole("link", { name: en.StudioWeek.repeat, exact: true })).toHaveCount(0);
  const item = page.locator("li", { hasText: "Repeat Dancer" });
  await item.getByRole("link", { name: en.StudioWeek.repeat, exact: true }).click();
  await expect(item.getByLabel(en.StudioWeek.repeatWeeks)).toHaveValue("4");
  await page.screenshot({ path: "out/screenshots/studio-week-repeat-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-week-repeat-laptop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await item.getByRole("button", { name: en.StudioWeek.repeatYes }).click();

  const result = page.locator("[data-repeated]");
  await expect(result).toContainText("Added 3 weeks.");
  const shown = new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  await expect(result).toContainText(shown.format(new Date(`${blocked.toISODate()}T12:00:00Z`)));

  const next = start.plus({ weeks: 1 });
  await page.goto(`/studio/week?start=${weekOf(localDate(next.toMillis())).start}`);
  await expect(
    page.locator(`section[data-day="${next.toISODate()}"]`).locator("li", { hasText: "Repeat Dancer" }),
  ).toBeVisible();
});
