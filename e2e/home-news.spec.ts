// The note of Nina shows on the home page until its end date (#655).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { removeNewsNote, saveNewsNote } from "../src/lib/news-note";

let db: Db;
const day = (plus: number) => DateTime.now().setZone("Europe/Amsterdam").plus({ days: plus }).toISODate() as string;

test.use({ viewport: { width: 390, height: 844 } });
test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
});
test.afterAll(() => removeNewsNote(db));

test("a note with an end date tomorrow shows in English and Dutch", async ({ page }, testInfo) => {
  saveNewsNote(db, { text: "Closed on Friday.\nSee you Monday <b>!</b>", until: day(1) });
  await page.goto("/en");
  const note = page.getByRole("complementary", { name: en.HomePage.news.title });
  await expect(note).toBeVisible();
  await expect(note).toContainText("See you Monday <b>!</b>");
  await expect(note.locator("b")).toHaveCount(0);
  await expect(note).toBeInViewport();
  const axe = await new AxeBuilder({ page }).include("aside").analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await page.screenshot({ path: `out/screenshots/home-news-390-${testInfo.project.name}.png` });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `out/screenshots/home-news-1280-${testInfo.project.name}.png` });
  await page.goto("/nl");
  await expect(page.getByRole("complementary", { name: nl.HomePage.news.title })).toContainText("Closed on Friday.");
});

test("a note whose end date is past does not show", async ({ page }) => {
  saveNewsNote(db, { text: "Old news", until: day(-1) });
  await page.goto("/en");
  await expect(page.getByText("Old news")).toHaveCount(0);
  await expect(page.locator("aside[aria-labelledby=news-title]")).toHaveCount(0);
});

test("no note: no element", async ({ page }, testInfo) => {
  removeNewsNote(db);
  await page.goto("/en");
  await expect(page.locator("aside[aria-labelledby=news-title]")).toHaveCount(0);
  await page.screenshot({ path: `out/screenshots/home-no-news-390-${testInfo.project.name}.png` });
});
