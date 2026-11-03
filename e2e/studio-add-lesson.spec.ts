// Nina adds a lesson that she agreed by WhatsApp or phone from the week page (#619): the offer, a day, a time, a name.
// The week shows it as approved with its price, the booking page no longer offers the time, and a time that another
// booking took meanwhile shows the free times again with a message.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingDays } from "../src/lib/booking-page";
import { localDate, weekOf } from "../src/lib/week";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("Nina adds a lesson with a name only, and the time is no longer free", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the add is for the phone");
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 45, priceCents: 5432, position: 97, visible: false });
  const free = bookingDays(db, offer).filter((day) => day.slots.length > 3);
  test.skip(free.length < 6, "the test needs open hours on 6 days");
  // Not the days of the move tests (#313).
  const target = free[4];
  const to = target.slots[2].start;

  await page.goto(`/studio/week?start=${weekOf(target.date).start}`);
  await page.getByRole("link", { name: en.StudioWeek.lessonAdd }).click();
  await page.locator(`a[href*="offer=${offer.id}"]`).click();
  await page.locator(`a[href*="day=${target.date}"]`).first().click();
  await page.locator(`a[href*="to=${to}"]`).click();
  await page.getByLabel(en.StudioWeek.lessonName).fill("Phone Dancer");
  await page.screenshot({ path: "out/screenshots/studio-week-add-lesson-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-week-add-lesson-laptop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: en.StudioWeek.lessonSave }).click();

  await expect(page).toHaveURL(new RegExp(`start=${weekOf(target.date).start}$`));
  const item = page.locator(`section[data-day="${localDate(to)}"]`).locator("li", { hasText: "Phone Dancer" });
  await expect(item).toContainText(en.StudioWeek.approved);
  await expect(item.locator("[data-price]")).toContainText("54.32");
  expect(bookingDays(db, offer).flatMap((d) => d.slots.map((s) => s.start))).not.toContain(to);
});

test("a time that another booking took meanwhile shows the free times again", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the add is for the phone");
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 45, priceCents: 5433, position: 98, visible: false });
  const free = bookingDays(db, offer).filter((day) => day.slots.length > 3);
  test.skip(free.length < 7, "the test needs open hours on 7 days");
  const target = free[5];
  const slot = target.slots[1];

  await page.goto(
    `/studio/week?start=${weekOf(target.date).start}&lesson=1&offer=${offer.id}&day=${target.date}&to=${slot.start}`,
  );
  await page.getByLabel(en.StudioWeek.lessonName).fill("Late Dancer");
  db.insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start: slot.start,
      end: slot.end,
      name: "Quick Dancer",
      email: "quick@example.test",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "requested",
      createdAt: Date.now(),
    })
    .run();
  await page.getByRole("button", { name: en.StudioWeek.lessonSave }).click();
  await expect(page.getByText(en.StudioWeek.moveTaken)).toBeVisible();
  await expect(page.getByText(en.StudioWeek.lessonDay)).toBeVisible();
});
