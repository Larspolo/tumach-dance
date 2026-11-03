// Nina moves a booking from the week page on her phone (#411): Move, a day, a time, "Yes, move" (4 taps). The week of
// the new time shows the booking, the dancer gets the move email, a requested booking stays requested (#434), and a
// cancelled booking has no Move link.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingDays } from "../src/lib/booking-page";
import { localDate, weekOf } from "../src/lib/week";
import { STUDIO_SESSION } from "./studio-session";

const LOG = "out/e2e/email.log";
const emailsTo = (to: string) =>
  readFileSync(LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { to: string; subject: string })
    .filter((email) => email.to === to);

test.use({ storageState: STUDIO_SESSION });

test("Nina moves an approved booking to another free time in 4 taps", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the move is for the phone");
  const db = openDb("out/e2e/tumach.db");
  // A hidden offer: the home page and the booking page do not show it.
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4321, position: 94, visible: false });
  // Not the last days of the booking page: other tests book there (#313).
  const free = bookingDays(db, offer).filter((day) => day.slots.length > 0);
  test.skip(free.length < 4, "the test needs open hours on 4 days");
  const [from, target] = [free[1], free[2]];
  const slot = from.slots[0];
  const email = `move-${Date.now()}@example.test`;
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start: slot.start,
      end: slot.end,
      name: "Move Dancer",
      email,
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      approvedAt: Date.now(),
      createdAt: Date.now(),
    })
    .returning()
    .get();
  const cancelled = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start: from.slots[from.slots.length - 1].start,
      end: from.slots[from.slots.length - 1].end,
      name: "Cancelled Dancer",
      email: "cancelled@example.test",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "cancelled",
      createdAt: Date.now(),
    })
    .returning()
    .get();

  await page.goto(`/studio/week?start=${weekOf(from.date).start}`);
  const item = page.locator("li", { hasText: "Move Dancer" });
  await expect(page.locator("li", { hasText: "Cancelled Dancer" })).toHaveCount(0);
  expect(cancelled.status).toBe("cancelled");

  await item.getByRole("link", { name: en.StudioWeek.move, exact: true }).click();
  await expect(item.getByText(en.StudioWeek.moveDay)).toBeVisible();
  await page.screenshot({ path: "out/screenshots/studio-week-move-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-week-move-laptop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await item.locator(`a[href*="day=${target.date}"]`).first().click();
  const to = target.slots[0].start;
  await item.locator(`a[href*="to=${to}"]`).click();
  await item.getByRole("button", { name: en.StudioWeek.moveYes }).click();

  await expect(page).toHaveURL(new RegExp(`start=${weekOf(target.date).start}`));
  const moved = page.locator(`section[data-day="${localDate(to)}"]`).locator("li", { hasText: "Move Dancer" });
  await expect(moved).toBeVisible();
  const shown = new Intl.DateTimeFormat("en", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
  await expect(moved).toContainText(shown.format(to));
  await expect.poll(() => emailsTo(email).length).toBe(1);
  expect(booking.id).toBeGreaterThan(0);
});

test("a started booking has no Move link", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the move is for the phone");
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "rental", minutes: 30, priceCents: 1234, position: 95, visible: false });
  const start = Date.now() - 10 * 60_000;
  db.insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start,
      end: start + 30 * 60_000,
      name: "Started Dancer",
      email: "started@example.test",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      createdAt: start - 60_000,
    })
    .run();
  await page.goto(`/studio/week?start=${localDate(start)}`);
  const item = page.locator("li", { hasText: "Started Dancer" });
  await expect(item).toBeVisible();
  await expect(item.getByRole("link", { name: en.StudioWeek.move, exact: true })).toHaveCount(0);
});

test("Nina moves a requested booking in 4 taps, and it stays requested", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the move is for the phone");
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4322, position: 96, visible: false });
  const free = bookingDays(db, offer).filter((day) => day.slots.length > 2);
  test.skip(free.length < 4, "the test needs open hours on 4 days");
  // Other slots than the test of the approved booking (#313).
  const [from, target] = [free[3], free[2]];
  const email = `move-requested-${Date.now()}@example.test`;
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start: from.slots[1].start,
      end: from.slots[1].end,
      name: "Requested Mover",
      email,
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "requested",
      createdAt: Date.now(),
    })
    .returning()
    .get();

  await page.goto(`/studio/week?start=${weekOf(from.date).start}`);
  const item = page.locator("li", { hasText: "Requested Mover" });
  await item.getByRole("link", { name: en.StudioWeek.move, exact: true }).click();
  await item.locator(`a[href*="day=${target.date}"]`).first().click();
  const to = target.slots[1].start;
  await item.locator(`a[href*="to=${to}"]`).click();
  await item.getByRole("button", { name: en.StudioWeek.moveYes }).click();

  await expect(page).toHaveURL(new RegExp(`start=${weekOf(target.date).start}`));
  const moved = page.locator(`section[data-day="${localDate(to)}"]`).locator("li", { hasText: "Requested Mover" });
  await expect(moved).toBeVisible();
  await expect.poll(() => emailsTo(email).length).toBe(1);
  const row = db
    .select()
    .from(bookings)
    .all()
    .find((b) => b.id === booking.id);
  expect(row).toMatchObject({ status: "requested", start: to });
});
