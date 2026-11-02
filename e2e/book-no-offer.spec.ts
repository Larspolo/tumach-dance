// The booking page with no visible offer links to the contact form on a phone (#485).
import { expect, test } from "@playwright/test";
import nl from "../messages/nl.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { listOffers, updateOffer } from "../src/db/offers";

let db: Db;
let hiddenIds: number[] = [];

test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");
test.use({ viewport: { width: 390, height: 844 } });

// Hide every visible offer, so the page shows no offer; afterAll shows them again for the other specs.
test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  hiddenIds = listOffers(db, { visibleOnly: true }).map((o) => o.id);
  for (const id of hiddenIds) updateOffer(db, id, { visible: false });
});

test.afterAll(() => {
  for (const id of hiddenIds) updateOffer(db, id, { visible: true });
});

test("no visible offer shows a link to the contact form", async ({ page }) => {
  await page.goto("/nl/book");
  await expect(page.getByText(nl.Book.noOffers)).toBeVisible();
  await expect(page.getByText(nl.Book.contactText)).toBeVisible();
  await page.getByRole("link", { name: nl.Book.contact }).click();
  await expect(page).toHaveURL(/\/nl#contact$/);
  await expect(page.locator("#contact")).toBeVisible();
});
