// The offers with their prices on the home page (#384): each visible offer with its price, a tap opens the booking
// page with that offer selected, and no section with no visible offer.
import { expect, test } from "@playwright/test";
import { type Db, openDb } from "../src/db";
import { addOffer, hideOffer, listOffers, type Offer, updateOffer } from "../src/db/offers";

let db: Db;
let mine: Offer[] = [];

test.use({ viewport: { width: 390, height: 844 } });

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  // Unusual prices find the offers of this test.
  mine = [
    addOffer(db, { kind: "lesson", minutes: 45, priceCents: 3847, position: 80 }),
    addOffer(db, { kind: "rental", minutes: 120, priceCents: 3848, position: 81 }),
  ];
});

test.afterAll(() => {
  for (const offer of mine) hideOffer(db, offer.id);
});

test("the home page shows each visible offer with its price and opens the booking page", async ({ page }) => {
  await page.goto("/en");
  const section = page.locator("#offers");
  for (const offer of listOffers(db, { visibleOnly: true })) {
    await expect(section.getByText(`€${(offer.priceCents / 100).toFixed(2)}`).first()).toBeVisible();
  }
  await section.locator(`a[href="/en/book?offer=${mine[0].id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/en/book\\?offer=${mine[0].id}$`));
  await expect(page.getByRole("main").locator('[aria-current="true"]')).toContainText("€38.47");
});

test("with no visible offer the home page has no offer section", async ({ page }) => {
  const visible = listOffers(db, { visibleOnly: true });
  for (const offer of visible) hideOffer(db, offer.id);
  try {
    await page.goto("/en");
    await expect(page.locator("#about")).toBeVisible();
    await expect(page.locator("#offers")).toHaveCount(0);
  } finally {
    for (const offer of visible) updateOffer(db, offer.id, { visible: true });
  }
});
