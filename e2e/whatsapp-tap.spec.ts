// The WhatsApp link of a booking is a tap target of at least 44 px on a phone, works with the keyboard and has no
// serious or critical axe barrier, on both studio pages that show it (#507, epic #495).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

// Press Tab until the link has the focus (at most 80 presses), then expect it.
async function tabTo(page: import("@playwright/test").Page, link: import("@playwright/test").Locator) {
  for (let i = 0; i < 80; i++) {
    if (await link.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(link).toBeFocused();
}

test("the WhatsApp link of a booking is a 44 px tap target, reachable by Tab, with no axe barrier", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the phone project only");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4242, position: 143 });
  const add = (name: string, iso: string, status: "requested" | "approved", removed = false) => {
    const start = DateTime.fromISO(iso, { zone: TIME_ZONE });
    db.insert(bookings)
      .values({
        offerId: offer.id,
        start: start.toMillis(),
        end: start.plus({ minutes: 60 }).toMillis(),
        name,
        email: removed ? "" : "tap@example.test",
        phone: removed ? "" : "+31 6 1234 5678",
        locale: "en",
        status,
        createdAt: Date.now(),
        forgottenAt: removed ? Date.now() : null,
      })
      .run();
  };
  // Days of 2033 that no other test books (the week test uses 7 and 8 June).
  add("Tap Request", "2033-06-14T10:00", "requested");
  add("Tap Approved", "2033-06-15T10:00", "approved");
  // A removed dancer's request has no email and no phone: its links must not be empty (axe, #507).
  add("Tap Removed", "2033-06-16T10:00", "requested", true);

  // The requests page.
  await page.goto("/studio/bookings");
  const request = page.locator("li", { hasText: "Tap Request" });
  const requestLink = request.getByRole("link", { name: "WhatsApp" });
  await expect(requestLink).toBeVisible();
  const requestBox = await requestLink.boundingBox();
  expect(requestBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await tabTo(page, requestLink);
  const requestAxe = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(requestAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  // The week page.
  await page.goto("/studio/week?start=2033-06-14");
  const weekLink = page.locator('section[data-day="2033-06-15"]').getByRole("link", { name: "WhatsApp" });
  await expect(weekLink).toBeVisible();
  const weekBox = await weekLink.boundingBox();
  expect(weekBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await tabTo(page, weekLink);
  const weekAxe = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(weekAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});
