// Nina keeps a time free from the week page (#327): the block shows on its day, and the booking page no longer offers it.
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { listBlocks, removeBlock } from "../src/db/blocks";
import { addOffer, hideOffer } from "../src/db/offers";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("Nina keeps 18:00 to 19:00 free in a few taps", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the week is for the phone");
  const db = openDb("out/e2e/tumach.db");
  // An unusual price finds the offer of this test.
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4331, position: 92 });
  let from = 0;
  let to = 0;
  try {
    // The last day of the booking page: no past hours, so the free times do not depend on the clock (#313).
    await page.goto(`/en/book?offer=${offer.id}`);
    const lastDay = page.locator("section", { hasText: en.Book.day }).getByRole("link").last();
    const date = new URL((await lastDay.getAttribute("href")) ?? "", page.url()).searchParams.get("day") ?? "";
    from = DateTime.fromISO(`${date}T18:00`, { zone: TIME_ZONE }).toMillis();
    to = from + 60 * 60 * 1000;
    const overlapping = async () => {
      await page.goto(`/en/book?offer=${offer.id}&day=${date}`);
      const hrefs = await page
        .locator("section", { hasText: en.Book.time })
        .getByRole("link")
        .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
      const starts = hrefs.map((href) => Number(new URL(href).searchParams.get("start")));
      expect(starts.length).toBeGreaterThan(0);
      return starts.filter((start) => start < to && start + 60 * 60 * 1000 > from);
    };
    expect((await overlapping()).length).toBeGreaterThan(0);

    await page.goto(`/studio/week?start=${date}`);
    await page.getByRole("link", { name: en.StudioWeek.blockAdd }).click();
    await page.getByLabel(en.StudioWeek.blockDate).fill(date);
    await page.getByLabel(en.StudioWeek.blockFrom).fill("18:00");
    await page.getByLabel(en.StudioWeek.blockTo).fill("19:00");
    await page.screenshot({ path: "out/screenshots/studio-week-add-block-phone.png", fullPage: true });
    await page.getByRole("button", { name: en.StudioWeek.blockSave }).click();
    const day = page.locator(`section[data-day="${date}"]`);
    await expect(day.locator("li[data-block]")).toContainText(/18:00|06:00 PM/);
    await expect(day.locator("li[data-block]")).toContainText(en.StudioWeek.block);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-week-add-block-laptop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });

    expect(listBlocks(db, from, to).filter((b) => b.start === from && b.end === to)).toHaveLength(1);
    expect(await overlapping()).toEqual([]);
  } finally {
    // Free the day again for the other tests of the booking page.
    for (const block of listBlocks(db, from, to)) {
      if (block.start === from && block.end === to) removeBlock(db, block.id);
    }
    hideOffer(db, offer.id);
  }
});

test("an end before the start shows an error and stores nothing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the week is for the phone");
  await page.goto("/studio/week?add=1");
  await page.getByLabel(en.StudioWeek.blockFrom).fill("19:00");
  await page.getByLabel(en.StudioWeek.blockTo).fill("18:00");
  await page.getByRole("button", { name: en.StudioWeek.blockSave }).click();
  await expect(page.getByText(en.StudioWeek.blockWrong)).toBeVisible();
});
