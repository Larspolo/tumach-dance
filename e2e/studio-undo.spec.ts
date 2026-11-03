// The Undo button after a tap on Approve or Decline (#573): the request is open again and the dancer gets no email.
import { existsSync, readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { UNDO_MS } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { STUDIO_SESSION } from "./studio-session";

const LOG = "out/e2e/email.log";
const mails = (to: string) =>
  existsSync(LOG)
    ? readFileSync(LOG, "utf8")
        .split("\n")
        .filter((line) => line.includes(to)).length
    : 0;

/** A request through the booking page with its own email address, at the `index`-th free time of the first day. */
async function request(page: Page, name: string, email: string, index: number) {
  await page.goto("/en/book");
  await page.getByRole("link", { name: /€43\.73/ }).click();
  await page.locator("section", { hasText: en.Book.day }).getByRole("link").first().click();
  await page.locator("section", { hasText: en.Book.time }).getByRole("link").nth(index).click();
  await page.getByLabel(en.Book.name).fill(name);
  await page.getByLabel(en.Book.email).fill(email);
  await page.getByLabel(en.Book.phone).fill("+31 6 1234 5678");
  await page.getByRole("button", { name: en.Book.send }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
}

test.use({ storageState: STUDIO_SESSION });

test("Nina undoes a decline, and an approval has no Undo after the undo time", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4373, position: 93 });
  await request(page, "Undo Me", "undo-me@example.test", 0);
  await request(page, "Keep Me", "keep-me@example.test", 0);

  await page.goto("/studio/bookings");
  const item = (name: string) => page.getByRole("list").first().locator("li", { hasText: name });
  const undoButton = page.getByRole("button", { name: en.StudioBookings.undoDecision, exact: true });
  const mailsBefore = mails("undo-me@example.test");

  await item("Undo Me").getByRole("button", { name: en.StudioBookings.decline }).click();
  await expect(page.getByText(en.StudioBookings.declined)).toBeVisible();
  await expect(undoButton).toBeVisible();
  await page.screenshot({ path: "out/screenshots/studio-undo-phone.png", fullPage: true });
  await undoButton.click();
  await expect(page.getByText(en.StudioBookings.undone)).toBeVisible();
  await expect(item("Undo Me")).toHaveCount(1);
  const row = (name: string) => db.select().from(bookings).where(eq(bookings.name, name)).get();
  expect(row("Undo Me")?.status).toBe("requested");

  await item("Keep Me").getByRole("button", { name: en.StudioBookings.approve }).click();
  await expect(page.getByText(en.StudioBookings.approved)).toBeVisible();
  await expect(undoButton).toBeVisible();
  // The undo time ends: the timer of the server sends the due emails one second after it.
  await page.waitForTimeout(UNDO_MS + 3_000);
  await page.reload();
  await expect(page.getByText(en.StudioBookings.approved)).toBeVisible();
  await expect(undoButton).toHaveCount(0);
  expect(row("Keep Me")?.status).toBe("approved");
  // The decline that Nina undid sent no email; the approval sent its email.
  expect(mails("undo-me@example.test")).toBe(mailsBefore);
  await expect.poll(() => mails("keep-me@example.test")).toBeGreaterThan(1);
});
