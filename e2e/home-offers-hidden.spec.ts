// A hidden offer does not show on the home page (#401, epic #380): no link to its booking page and no price in #offers.
import { expect, test } from "@playwright/test";
import { type Db, openDb } from "../src/db";
import { addOffer, hideOffer, type Offer } from "../src/db/offers";

let db: Db;
let hidden: Offer;

test.use({ viewport: { width: 390, height: 844 } });

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  // An unusual price finds the offer of this test.
  hidden = addOffer(db, { kind: "lesson", minutes: 50, priceCents: 3849, position: 82 });
  hideOffer(db, hidden.id);
});

test.afterAll(() => {
  hideOffer(db, hidden.id);
});

test("a hidden offer does not show on the home page", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("#about")).toBeVisible();
  const section = page.locator("#offers");
  await expect(section.locator(`a[href="/en/book?offer=${hidden.id}"]`)).toHaveCount(0);
  await expect(section.getByText("€38.49")).toHaveCount(0);
});
