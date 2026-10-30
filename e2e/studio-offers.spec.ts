// The offers of the studio app on a phone (#31): the session of `studio.setup.ts`, add, change and hide.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test("without a session the offers page goes to the login page", async ({ page }) => {
  await page.goto("/studio/offers");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test.describe("with a session", () => {
  test.use({ storageState: STUDIO_SESSION });

  test("Nina adds an offer, changes its price and hides it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the offers are for the phone");
    await page.goto("/studio");
    await page.getByRole("link", { name: en.StudioHome.offers }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioOffers.title);

    const name = en.StudioOffers.rental.replace("{minutes}", "120");
    const offer = page.locator("details", { has: page.locator("summary", { hasText: name }) });
    const count = await offer.count();
    await page.getByText(en.StudioOffers.add, { exact: true }).click();
    await page.getByLabel(en.StudioOffers.rentalKind).check();
    const addForm = page.locator("form", {
      has: page.getByRole("button", { name: en.StudioOffers.addSave, exact: true }),
    });
    await addForm.getByLabel(en.StudioOffers.length).selectOption("120");
    await addForm.getByLabel(en.StudioOffers.price).fill("80");
    await addForm.getByRole("button", { name: en.StudioOffers.addSave, exact: true }).click();
    await expect(offer).toHaveCount(count + 1);
    const last = offer.last();
    await expect(last.locator("summary")).toContainText("€80.00");

    await last.locator("summary").click();
    await last.getByLabel(en.StudioOffers.price).fill("85,50");
    await last.getByRole("button", { name: en.StudioOffers.save }).click();
    await expect(last.locator("summary")).toContainText("€85.50");

    // The details can stay open after the save: open it only when it is closed.
    if (!(await last.evaluate((el) => (el as HTMLDetailsElement).open))) await last.locator("summary").click();
    await last.getByRole("button", { name: en.StudioOffers.hide }).click();
    await expect(last.locator("summary")).toContainText(en.StudioOffers.hidden);
    await page.screenshot({ path: "out/screenshots/studio-offers-phone.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-offers-laptop.png", fullPage: true });
  });
});
