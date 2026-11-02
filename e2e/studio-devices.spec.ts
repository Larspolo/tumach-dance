// The page of the devices where Nina is logged in (#585).
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("the tile opens the devices and the page marks this device", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the phone project only");
  await page.goto("/studio");
  await page.getByRole("link", { name: en.StudioHome.devices, exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/devices$/);
  await expect(page.getByRole("heading", { name: en.Devices.title })).toBeVisible();
  const current = page.getByRole("listitem").filter({ hasText: en.Devices.thisDevice });
  await expect(current).toHaveCount(1);
  await expect(current).toContainText(en.Devices.lastUse.replace("{day}", en.Devices.today));
});
