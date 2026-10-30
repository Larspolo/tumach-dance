// The studio app speaks the language of Nina's browser (#43), though its address has no locale.
import { expect, test } from "@playwright/test";
import nl from "../messages/nl.json" with { type: "json" };

test.use({ locale: "nl-NL" });

test("/studio shows the Dutch texts for a Dutch browser", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/studio\/login$/);
  await expect(page.getByRole("button", { name: nl.StudioLogin.sendCode })).toBeVisible();
  await expect(page.getByLabel(nl.StudioLogin.emailLabel)).toBeVisible();
});
