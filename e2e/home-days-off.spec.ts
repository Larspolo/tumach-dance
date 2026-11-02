// The schedule of the home page names a date with no class: a closed day of the studio (#532, Nina's answer A of #531).
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { type Db, openDb } from "../src/db";
import { addClass, addClassTime, type Class, hideClass } from "../src/db/classes";
import type { HoursRule, Weekday } from "../src/lib/hours";
import { getHoursRule, saveHoursRule } from "../src/lib/hours-store";

let db: Db;
let before: HoursRule;
let cls: Class;
const tag = `${Date.now()}`;
const today = DateTime.now().setZone("Europe/Amsterdam").startOf("day");
const off = today.plus({ days: 9 });
const far = today.plus({ days: 9 + 35 });
const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  before = getHoursRule(db);
  cls = addClass(db, { name: { en: `Bachata ${tag}` }, text: { en: "-" }, forWhom: { en: "All" }, position: 9 });
  addClassTime(db, { classId: cls.id, weekday: WEEKDAYS[off.weekday - 1], from: "19:00", to: "20:00" });
  saveHoursRule(db, { ...before, closed: [{ from: off.toISODate() ?? "" }, { from: far.toISODate() ?? "" }] });
});

test.afterAll(() => {
  saveHoursRule(db, before);
  hideClass(db, cls.id);
});

test("a class row names its date with no class in the next 4 weeks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "one look on a phone (390×844)");
  const day = (d: DateTime, locale: string) => d.setLocale(locale).toLocaleString({ day: "numeric", month: "long" });
  await page.goto("/en");
  const row = page.locator("#schedule div", { hasText: `Bachata ${tag}` }).last();
  await expect(row).toContainText(`No class on ${day(off, "en")}.`);
  await expect(row).not.toContainText(day(far, "en"));
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("home-days-off-en.png") });
  await page.goto("/nl");
  await expect(page.locator("#schedule")).toContainText(`Geen les op ${day(off, "nl")}.`);
});
