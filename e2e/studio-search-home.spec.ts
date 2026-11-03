// Nina starts a search of the bookings from the studio home on a phone (#665, epic #662).
import { expect, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

let db: Db;
let ids: number[] = [];
const name = `Homey${Date.now()}`;

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4665, position: 665 });
  const start = DateTime.now().setZone(TIME_ZONE).plus({ days: 9 }).set({ hour: 12, minute: 0 });
  ids = [
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: start.toMillis(),
        end: start.plus({ minutes: 60 }).toMillis(),
        priceCents: 4665,
        name: `${name} approved`,
        email: "searchhome@example.test",
        phone: "+31 6 0000 0665",
        locale: "en",
        status: "approved",
        createdAt: Date.now(),
        paidAt: null,
      })
      .returning({ id: bookings.id })
      .get().id,
  ];
});

test.afterAll(() => {
  db.delete(bookings).where(inArray(bookings.id, ids)).run();
});

test("a search from the studio home opens the search page with the text", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await page.getByLabel(en.StudioHome.search).fill(name.slice(2).toLowerCase());
  await page.getByRole("button", { name: en.StudioHome.searchButton }).click();
  await expect(page).toHaveURL(/\/studio\/search\?q=/);
  const items = page.getByTestId("search-bookings").locator("li");
  await expect(items).toHaveCount(1);
  await expect(items.nth(0)).toHaveAttribute("data-booking", String(ids[0]));
});
