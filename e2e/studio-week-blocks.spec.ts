// The blocked times of Nina on the week page (#326): a block shows on its day, and "Remove" removes it.
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addBlock, listBlocks } from "../src/db/blocks";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("a block shows on its day and one tap removes it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the week is for the phone");
  const db = openDb("out/e2e/tumach.db");
  // A Thursday far in the future: no other test uses it.
  const start = DateTime.fromISO("2032-03-18T10:00", { zone: TIME_ZONE });
  const block = addBlock(db, { start: start.toMillis(), end: start.plus({ hours: 2 }).toMillis() });

  await page.goto("/studio/week?start=2032-03-18");
  const day = page.locator('section[data-day="2032-03-18"]');
  const item = day.locator(`li[data-block="${block.id}"]`);
  await expect(item).toContainText("10:00");
  await expect(item).toContainText("12:00");
  await expect(item).toContainText(en.StudioWeek.block);
  await expect(day).not.toContainText(en.StudioWeek.free);
  await page.screenshot({ path: "out/screenshots/studio-week-blocks-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-week-blocks-laptop.png", fullPage: true });

  await item.getByRole("button", { name: en.StudioWeek.blockRemove }).click();
  await expect(day.locator(`li[data-block="${block.id}"]`)).toHaveCount(0);
  await expect(day).toContainText(en.StudioWeek.free);
  expect(listBlocks(db, block.start, block.end).some((b) => b.id === block.id)).toBe(false);
});
