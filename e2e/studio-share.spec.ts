// Nina shares the free times of an offer from the offers page (#728, epic #723): the share sheet of the phone, or
// the clipboard with no share; a hidden offer has no button.
import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { offers } from "../src/db/schema";
import { STUDIO_SESSION } from "./studio-session";

const s = en.StudioShare;
test.use({ storageState: STUDIO_SESSION });

test("each visible offer shares its free times; a hidden offer has no button", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the share is for the phone");
  const db = openDb("out/e2e/tumach.db");
  const hidden = addOffer(db, { kind: "rental", minutes: 90, priceCents: 1234, position: 99, visible: false });
  const shown = addOffer(db, { kind: "rental", minutes: 120, priceCents: 4567, position: 99, visible: true });
  try {
    await page.addInitScript(() => {
      const w = window as unknown as { shared: string[] };
      w.shared = [];
      Object.defineProperty(navigator, "share", {
        value: async ({ text }: { text: string }) => {
          w.shared.push(text);
        },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio/offers");
    const items = page.locator("main > ul > li");
    const visibleCount = db
      .select()
      .from(offers)
      .all()
      .filter((o) => o.visible).length;
    await expect(page.getByRole("button", { name: s.share })).toHaveCount(visibleCount);
    await expect(items.filter({ hasText: "12.34" }).getByRole("button", { name: s.share })).toHaveCount(0);

    const first = items.filter({ hasText: "45.67" });
    await first.getByLabel(s.language).selectOption("nl");
    await first.getByRole("button", { name: s.share }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared: string[] }).shared)).toHaveLength(1);
    const text = await page.evaluate(() => (window as unknown as { shared: string[] }).shared[0]);
    expect(text).toMatch(/Boek hier|Geen vrije tijd|Vrije tijden/);
    await page.screenshot({ path: "out/screenshots/studio-share-phone.png" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-share-laptop.png" });
  } finally {
    db.delete(offers)
      .where(inArray(offers.id, [hidden.id, shown.id]))
      .run();
  }
});

test("with no share, the text goes to the clipboard and the page says so", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the share is for the phone");
  const db = openDb("out/e2e/tumach.db");
  const shown = addOffer(db, { kind: "rental", minutes: 120, priceCents: 4568, position: 99, visible: true });
  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio/offers");
    await page.locator("main > ul > li").filter({ hasText: "45.68" }).getByRole("button", { name: s.share }).click();
    await expect(page.getByText(s.copied)).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/Book here|No free time|Free times/);
  } finally {
    db.delete(offers).where(eq(offers.id, shown.id)).run();
  }
});
