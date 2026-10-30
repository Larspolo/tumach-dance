// Nina adds the calendar feed to her phone with one tap and makes a new address (#104).
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("the calendar link has the feed address, and a new address stops the old one", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the phone project (390×844) only");
  await page.goto("/studio");
  const link = page.getByRole("link", { name: en.StudioHome.calendarAdd });
  const old = (await link.getAttribute("href")) ?? "";
  expect(old).toMatch(/^webcal:\/\/[^/]+\/api\/calendar\/[\w-]+\.ics$/);
  const oldPath = new URL(old.replace("webcal://", "http://")).pathname;
  expect((await request.get(oldPath)).status()).toBe(200);
  await page.screenshot({ path: testInfo.outputPath("studio-calendar.png"), fullPage: true });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: en.StudioHome.calendarRenew }).click();
  await expect(link).not.toHaveAttribute("href", old);
  expect(await link.getAttribute("href")).toMatch(/^webcal:\/\/.+\.ics$/);
  expect((await request.get(oldPath)).status()).toBe(404);
});
