// Nina opens the earlier bookings of a dancer from the week page and the requests page, on a phone (#623).
import { expect, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

const db = () => openDb("out/e2e/tumach.db");

function addBooking(
  offerId: number,
  start: DateTime,
  values: { name: string; email: string; status: "requested" | "approved" | "declined"; paidAt?: number | null },
): number {
  return db()
    .insert(bookings)
    .values({
      offerId,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      priceCents: 5000,
      phone: "",
      locale: "en",
      createdAt: Date.now(),
      paidAt: null,
      ...values,
    })
    .returning({ id: bookings.id })
    .get().id;
}

test("the week page and the requests page open the earlier bookings of the dancer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const offer = addOffer(db(), { kind: "lesson", minutes: 60, priceCents: 5000, position: 623 });
  const email = `dancer-${Date.now()}@example.test`;
  const name = `Dancer ${Date.now()}`;
  const now = DateTime.now().setZone(TIME_ZONE);
  const week = now.startOf("week").plus({ days: 2 }).set({ hour: 23, minute: 0 });
  const ids = [
    addBooking(offer.id, week, { name, email, status: "approved" }),
    addBooking(offer.id, now.minus({ weeks: 6 }).set({ hour: 10, minute: 0 }), {
      name,
      email,
      status: "approved",
      paidAt: Date.now(),
    }),
    addBooking(offer.id, now.minus({ weeks: 3 }).set({ hour: 10, minute: 0 }), { name, email, status: "declined" }),
    addBooking(offer.id, now.plus({ weeks: 3 }).set({ hour: 23, minute: 30 }), { name, email, status: "requested" }),
  ];
  try {
    await page.goto(`/studio/week?start=${now.startOf("week").toISODate()}`);
    const row = page.locator("li", { hasText: name }).first();
    await row.getByRole("link", { name: en.StudioDancer.link }).click();
    await expect(page.getByRole("heading", { name: en.StudioDancer.title.replace("{name}", name) })).toBeVisible();
    const items = page.getByTestId("dancer-bookings").locator("li");
    await expect(items).toHaveCount(3);
    // Newest first: the request, the declined booking, the paid booking.
    await expect(items.nth(0)).toContainText(en.StudioDancer.status.requested);
    await expect(items.nth(1)).toContainText(en.StudioDancer.status.declined);
    await expect(items.nth(2)).toContainText(en.StudioDancer.paid);
    await page.screenshot({ path: "out/e2e/studio-dancer-390.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/e2e/studio-dancer-1280.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("link", { name: en.StudioDancer.back }).click();
    await expect(page).toHaveURL(/\/studio\/week\?start=/);

    await page.goto("/studio/bookings");
    await page.locator("li", { hasText: name }).first().getByRole("link", { name: en.StudioDancer.link }).click();
    await expect(page.getByTestId("dancer-bookings").locator("li")).toHaveCount(3);
    await page.getByRole("link", { name: en.StudioDancer.back }).click();
    await expect(page).toHaveURL(/\/studio\/bookings$/);
  } finally {
    db().delete(bookings).where(inArray(bookings.id, ids)).run();
  }
});

test("a dancer with no other booking shows the calm text", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const offer = addOffer(db(), { kind: "lesson", minutes: 60, priceCents: 5000, position: 624 });
  const id = addBooking(offer.id, DateTime.now().setZone(TIME_ZONE).plus({ days: 1 }).set({ hour: 23 }), {
    name: `Alone ${Date.now()}`,
    email: `alone-${Date.now()}@example.test`,
    status: "approved",
  });
  try {
    await page.goto(`/studio/dancer/${id}?back=%2Fstudio%2Fweek`);
    await expect(page.getByText(en.StudioDancer.none)).toBeVisible();
  } finally {
    db()
      .delete(bookings)
      .where(inArray(bookings.id, [id]))
      .run();
  }
});
