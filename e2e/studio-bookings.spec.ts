// The open booking requests in the studio app on a phone (#76): two requests of the booking page, approve and decline.
import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { STUDIO_SESSION } from "./studio-session";

let db: Db;

test("without a session the bookings page goes to the login page", async ({ page }) => {
  await page.goto("/studio/bookings");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

/** A request through the booking page of #36, with the `index`-th free time of the first day. */
async function request(page: Page, name: string, index: number) {
  await page.goto("/en/book");
  await page.getByRole("link", { name: /€43\.31/ }).click();
  await page.locator("section", { hasText: en.Book.day }).getByRole("link").first().click();
  await page.locator("section", { hasText: en.Book.time }).getByRole("link").nth(index).click();
  await page.getByLabel(en.Book.name).fill(name);
  await page.getByLabel(en.Book.email).fill("dancer@example.test");
  await page.getByLabel(en.Book.phone).fill("+31 6 1234 5678");
  await page.getByRole("button", { name: en.Book.send }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
}

test.describe("with a session", () => {
  test.use({ storageState: STUDIO_SESSION });

  test("Nina approves one request and declines another", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the bookings are for the phone");
    db = openDb("out/e2e/tumach.db");
    // An unusual price finds the offer of this test.
    addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4331, position: 92 });
    await request(page, "Approve Me", 0);
    await request(page, "Decline Me", 0);

    await page.goto("/studio");
    await page.getByRole("link", { name: en.StudioHome.bookings }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioBookings.title);
    // The first list holds the open requests; an approved booking moves to the list "Approved bookings" (#203).
    const item = (name: string) => page.getByRole("list").first().locator("li", { hasText: name });
    await expect(item("Approve Me").getByRole("link", { name: "dancer@example.test" })).toHaveAttribute(
      "href",
      "mailto:dancer@example.test",
    );
    await expect(item("Approve Me").getByRole("link", { name: "+31 6 1234 5678" })).toHaveAttribute(
      "href",
      "tel:+31612345678",
    );
    await page.screenshot({ path: "out/screenshots/studio-bookings-phone.png", fullPage: true });

    await item("Approve Me").getByRole("button", { name: en.StudioBookings.approve }).click();
    await expect(page.getByText(en.StudioBookings.approved)).toBeVisible();
    await expect(item("Approve Me")).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: "Approve Me" })).toHaveCount(1);
    await item("Decline Me").getByRole("button", { name: en.StudioBookings.decline }).click();
    await expect(page.getByText(en.StudioBookings.declined)).toBeVisible();
    await expect(item("Decline Me")).toHaveCount(0);

    const status = (name: string) => db.select().from(bookings).where(eq(bookings.name, name)).get()?.status;
    expect(status("Approve Me")).toBe("approved");
    expect(status("Decline Me")).toBe("declined");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-bookings-laptop.png", fullPage: true });
  });
});
