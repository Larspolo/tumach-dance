// The Bookings tile of the studio home counts the requests that wait for Nina, and one tap opens them (#675).
import { expect, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { countOpenRequests } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
});

function request(db: ReturnType<typeof openDb>, offerId: number, start: DateTime, name: string) {
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
      status: "requested",
      createdAt: Date.now(),
      paidAt: null,
    })
    .returning({ id: bookings.id })
    .get();
}

test("the Bookings tile counts the waiting requests and opens them", async ({ page }) => {
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 675 });
  const inTwoDays = DateTime.now().setZone(TIME_ZONE).startOf("day").plus({ days: 2 });
  const stamp = Date.now();
  const a = request(db, offer.id, inTwoDays.set({ hour: 11 }), `Request A ${stamp}`);
  const b = request(db, offer.id, inTwoDays.set({ hour: 15 }), `Request B ${stamp}`);
  try {
    const count = countOpenRequests(db);
    const tileText = en.StudioHome.bookingsCount.replace("{count}", String(count));
    await page.goto("/studio");
    const tile = page.getByRole("link", { name: tileText, exact: true });
    await expect(tile).toBeVisible();
    await tile.click();
    await expect(page).toHaveURL(/\/studio\/bookings$/);
    await expect(page.locator(`#booking-${a.id}`)).toBeAttached();
    await expect(page.locator(`#booking-${b.id}`)).toBeAttached();
  } finally {
    db.delete(bookings)
      .where(inArray(bookings.id, [a.id, b.id]))
      .run();
  }
});
