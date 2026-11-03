// Nina searches the bookings by a part of a name on a phone (#664), also with no JavaScript.
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
const name = `Searchy${Date.now()}`;

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4664, position: 664 });
  const at = (days: number) => DateTime.now().setZone(TIME_ZONE).plus({ days }).set({ hour: 11, minute: 0 });
  const add = (days: number, status: "approved" | "declined") =>
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: at(days).toMillis(),
        end: at(days).plus({ minutes: 60 }).toMillis(),
        priceCents: 4664,
        name: `${name} ${status}`,
        email: "search@example.test",
        phone: "+31 6 0000 0664",
        locale: "en",
        status,
        createdAt: Date.now(),
        paidAt: null,
      })
      .returning({ id: bookings.id })
      .get().id;
  // The approved one is newer (later start) than the declined one.
  ids = [add(9, "approved"), add(-20, "declined")];
});

test.afterAll(() => {
  db.delete(bookings).where(inArray(bookings.id, ids)).run();
});

test("a part of a name lists the bookings newest first, and a tap opens the week", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio/search");
  await page.getByLabel(en.StudioSearch.label).fill(name.slice(2).toLowerCase());
  await page.getByRole("button", { name: en.StudioSearch.button }).click();
  const items = page.getByTestId("search-bookings").locator("li");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveAttribute("data-booking", String(ids[0]));
  await expect(items.nth(1)).toHaveAttribute("data-booking", String(ids[1]));
  await testInfo.attach("search-phone", {
    body: await page.screenshot({ fullPage: true, path: "out/shots/search-phone.png" }),
    contentType: "image/png",
  });
  await items.nth(0).getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/studio/week\\?start=.*#booking-${ids[0]}$`));
  await expect(page.locator(`#booking-${ids[0]}`)).toBeInViewport();
});

test("a text with no match shows one line", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.goto("/studio/search?q=zzqqxxnomatch");
  await expect(page.getByText(en.StudioSearch.none)).toBeVisible();
  await expect(page.getByTestId("search-bookings")).toHaveCount(0);
});

test.describe("with no JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the form sends the query and lists the bookings", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
    await page.goto("/studio/search");
    await page.getByLabel(en.StudioSearch.label).fill(name);
    await page.getByRole("button", { name: en.StudioSearch.button }).click();
    await expect(page.getByTestId("search-bookings").locator("li")).toHaveCount(2);
  });
});

test("the search page on a laptop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "one screenshot");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/studio/search?q=${name}`);
  await expect(page.getByTestId("search-bookings").locator("li")).toHaveCount(2);
  await testInfo.attach("search-laptop", {
    body: await page.screenshot({ fullPage: true, path: "out/shots/search-laptop.png" }),
    contentType: "image/png",
  });
});
