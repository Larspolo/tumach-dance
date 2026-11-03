// The studio home lists the lessons of today and tomorrow, each one tap from its booking (#661).
import { expect, test } from "@playwright/test";
import { and, eq, gte, inArray, lt, or } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
});

// The time as the studio home shows it (English studio of the test browser).
const time = (start: DateTime) =>
  new Intl.DateTimeFormat("en", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(start.toMillis());

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

test("the studio home lists the lessons of today and tomorrow", async ({ page }) => {
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 661 });
  const startOfToday = DateTime.now().setZone(TIME_ZONE).startOf("day");
  const stamp = Date.now();
  const todayName = `Today ${stamp}`;
  const tomorrowName = `Tomorrow ${stamp}`;
  // 23:00 today stays in the future for most of the day; the list keeps a lesson of today that has ended.
  const a = lesson(db, offer.id, startOfToday.set({ hour: 23 }), todayName);
  const b = lesson(db, offer.id, startOfToday.plus({ days: 1 }).set({ hour: 10 }), tomorrowName);
  try {
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: en.StudioHome.today, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: en.StudioHome.tomorrow, exact: true })).toBeVisible();
    const todayLink = page.getByRole("link", { name: todayName });
    await expect(todayLink).toContainText(time(startOfToday.set({ hour: 23 })));
    await expect(page.getByRole("link", { name: tomorrowName })).toContainText(
      time(startOfToday.plus({ days: 1 }).set({ hour: 10 })),
    );
    await expect(page.getByText(en.StudioHome.nothing)).toHaveCount(0);
    await page.screenshot({ path: "out/screenshots/studio-today-phone.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-today-laptop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await todayLink.click();
    await expect(page).toHaveURL(new RegExp(`/studio/bookings#booking-${a.id}$`));
    await expect(page.locator(`#booking-${a.id}`)).toBeInViewport();
  } finally {
    db.delete(bookings)
      .where(inArray(bookings.id, [a.id, b.id]))
      .run();
  }
});

test("the studio home says that there is nothing to do", async ({ page }) => {
  const db = openDb("out/e2e/tumach.db");
  const now = Date.now();
  const end = DateTime.now().setZone(TIME_ZONE).startOf("day").plus({ days: 2 }).toMillis();
  // The database is shared: put the open requests and the lessons of the next two days aside, then back (workers: 1).
  const aside = db
    .select({ id: bookings.id, status: bookings.status })
    .from(bookings)
    .where(
      or(
        and(eq(bookings.status, "requested"), gte(bookings.start, now)),
        and(eq(bookings.status, "approved"), gte(bookings.start, now - 86_400_000), lt(bookings.start, end)),
      ),
    )
    .all();
  for (const row of aside) db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, row.id)).run();
  try {
    await page.goto("/studio");
    await expect(page.getByText(en.StudioHome.nothing)).toBeVisible();
    await expect(page.getByRole("heading", { name: en.StudioHome.today, exact: true })).toHaveCount(0);
  } finally {
    for (const row of aside) db.update(bookings).set({ status: row.status }).where(eq(bookings.id, row.id)).run();
  }
});
