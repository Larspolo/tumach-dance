// The privacy page (#226): the footer and the booking form link to it in the same language.
import { expect, test } from "@playwright/test";
import nl from "../messages/nl.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { KEEP_MONTHS } from "../src/lib/booking-privacy";

test("the footer of the home page links to the privacy page", async ({ page }, info) => {
  await page.goto("/nl");
  await page.locator("footer").getByRole("link", { name: nl.Footer.privacy }).click();
  await expect(page).toHaveURL(/\/nl\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: nl.Privacy.title })).toBeVisible();
  await expect(page.getByText(`${KEEP_MONTHS} maanden na je les`)).toBeVisible();
  await page.screenshot({ path: `out/screenshots/privacy-${info.project.name}.png`, fullPage: true });
});

test("the booking form links to the privacy page", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the booking page is for a phone");
  const db = openDb("out/e2e/tumach.db");
  addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4521, position: 92 });
  await page.goto("/nl/book");
  await page.getByRole("link", { name: /45,21/ }).click();
  await page.locator("section", { hasText: nl.Book.day }).getByRole("link").first().click();
  await page.locator("section", { hasText: nl.Book.time }).getByRole("link").first().click();
  await page.locator("form").getByRole("link", { name: nl.Book.privacy }).click();
  await expect(page).toHaveURL(/\/nl\/privacy$/);
});
