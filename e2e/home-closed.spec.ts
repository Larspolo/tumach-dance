// The home page shows a coming closed period of the studio in the section "Prices" (#530, #792).
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { type Db, openDb } from "../src/db";
import type { HoursRule } from "../src/lib/hours";
import { getHoursRule, saveHoursRule } from "../src/lib/hours-store";

let db: Db;
let before: HoursRule;
const today = DateTime.now().setZone("Europe/Amsterdam").startOf("day");
const from = today.plus({ days: 10 });
const to = today.plus({ days: 14 });
const far = today.plus({ days: 60 });

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  before = getHoursRule(db);
  saveHoursRule(db, {
    ...before,
    closed: [{ from: from.toISODate() ?? "", to: to.toISODate() ?? "" }, { from: far.toISODate() ?? "" }],
  });
});

test.afterAll(() => saveHoursRule(db, before));

test("the home page shows a closed period that starts in less than 4 weeks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "one look on a phone (390×844)");
  const day = (d: DateTime, locale: string) => d.setLocale(locale).toLocaleString({ day: "numeric", month: "long" });
  await page.goto("/en");
  const prices = page.locator("#offers");
  await expect(prices).toContainText(`Closed from ${day(from, "en")} to ${day(to, "en")}.`);
  await expect(prices).not.toContainText(day(far, "en"));
  await prices.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("home-closed-en.png") });
  await page.goto("/nl");
  await expect(page.locator("#offers")).toContainText(`Gesloten van ${day(from, "nl")} tot en met ${day(to, "nl")}.`);
});
