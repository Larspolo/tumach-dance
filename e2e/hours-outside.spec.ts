// Nina closes a date with a booking (#713, epic #711 nina:holiday): the hours page lists the booking that is now
// outside her open hours, one tap from its booking; she opens the date again and the list goes away.
import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingDays } from "../src/lib/booking-page";
import { getHoursRule, saveHoursRule } from "../src/lib/hours-store";
import { STUDIO_SESSION } from "./studio-session";

const h = en.StudioHours;
test.use({ storageState: STUDIO_SESSION });

test("the hours page lists a booking on a closed date", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the hours are set on a phone");
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4100, position: 97, visible: false });
  const free = bookingDays(db, offer).filter((day) => day.slots.length > 0);
  test.skip(free.length < 2, "the test needs open hours");
  const day = free[free.length - 1];
  const before = getHoursRule(db);
  const at = day.slots[day.slots.length - 1].start;
  const added = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start: at,
      end: at + 60 * 60_000,
      name: "Outside Dancer",
      email: `outside-${Date.now()}@example.test`,
      phone: "",
      locale: "en",
      status: "approved",
      approvedAt: Date.now(),
      createdAt: Date.now(),
    })
    .returning()
    .all();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio/hours");
    const outside = page.getByRole("list", { name: h.outsideWhy });
    const item = page.getByRole("link", { name: /Outside Dancer/ });
    await expect(item).toHaveCount(0);

    const closeForm = page.getByRole("form", { name: h.closedDates });
    await closeForm.getByLabel(h.closedFrom).fill(day.date);
    await closeForm.getByLabel(h.closedTo).fill("");
    await closeForm.getByRole("button", { name: h.close }).click();
    await expect(page.getByText(h.outsideWhy, { exact: true })).toBeVisible();
    await expect(outside.getByRole("link", { name: /Outside Dancer/ })).toContainText("Private lesson, 60 min");
    await expect(item).toHaveAttribute("href", new RegExp(`/studio/week\\?start=${day.date}#booking-${added[0].id}$`));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "out/screenshots/hours-outside-phone.png" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "out/screenshots/hours-outside-laptop.png" });
    await page.setViewportSize({ width: 390, height: 844 });

    const closedList = page.getByRole("list", { name: h.closedDates });
    await closedList
      .getByRole("button", { name: new RegExp(`^${h.remove}: `) })
      .last()
      .click();
    await expect(item).toHaveCount(0);
  } finally {
    db.delete(bookings)
      .where(
        inArray(
          bookings.id,
          added.map((b) => b.id),
        ),
      )
      .run();
    saveHoursRule(db, before);
  }
});

test("Nina cancels the bookings outside her hours from the hours page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the hours are set on a phone");
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4200, position: 98, visible: false });
  const free = bookingDays(db, offer).filter((day) => day.slots.length > 0);
  test.skip(free.length < 2, "the test needs open hours");
  const day = free[free.length - 1];
  const before = getHoursRule(db);
  const at = day.slots[day.slots.length - 1].start;
  const [added] = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start: at,
      end: at + 60 * 60_000,
      name: "Holiday Dancer",
      email: `holiday-${Date.now()}@example.test`,
      phone: "",
      locale: "en",
      status: "approved",
      approvedAt: Date.now(),
      createdAt: Date.now(),
    })
    .returning()
    .all();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio/hours");
    const closeForm = page.getByRole("form", { name: h.closedDates });
    await closeForm.getByLabel(h.closedFrom).fill(day.date);
    await closeForm.getByLabel(h.closedTo).fill("");
    await closeForm.getByRole("button", { name: h.close }).click();
    await expect(page.getByRole("link", { name: /Holiday Dancer/ })).toBeVisible();

    await page.getByRole("link", { name: h.outsideCancel }).click();
    await expect(page.locator("[data-cancel-outside]")).toContainText(/Cancel \d+ booking/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "out/screenshots/hours-outside-cancel-phone.png" });
    await page.getByRole("button", { name: h.outsideYes }).click();
    await expect(page.locator("[data-outside-cancelled]")).toContainText(/Cancelled \d+ booking/);
    await expect(page.getByRole("link", { name: /Holiday Dancer/ })).toHaveCount(0);
    expect(db.select().from(bookings).where(eq(bookings.id, added.id)).get()?.status).toBe("cancelled");
  } finally {
    db.delete(bookings).where(eq(bookings.id, added.id)).run();
    saveHoursRule(db, before);
  }
});
