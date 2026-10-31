// The classes and the weekly schedule of the home page come from the database (#98).
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addClass, addClassTime, type Class, hideClass, listClasses } from "../src/db/classes";
import { classes } from "../src/db/schema";

// The database of the test server (`playwright.config.ts`). A unique tag finds the classes of this test.
let db: Db;
let salsa: Class;
let kizomba: Class;
let hidden: Class;
const tag = `${Date.now()}`;

test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  salsa = addClass(db, {
    name: { en: `Salsa ${tag}`, nl: `Salsa NL ${tag}` },
    text: { en: "Turns and fun." },
    forWhom: { en: "Beginners" },
    position: 0,
  });
  kizomba = addClass(db, {
    name: { en: `Kizomba ${tag}` },
    text: { en: "Slow and close." },
    forWhom: { en: "All levels", nl: "Alle niveaus" },
    position: 1,
  });
  hidden = addClass(db, { name: { en: `Hidden ${tag}` }, text: { en: "-" }, forWhom: { en: "-" }, position: 2 });
  addClassTime(db, { classId: kizomba.id, weekday: "wed", from: "20:00", to: "21:00" });
  addClassTime(db, { classId: salsa.id, weekday: "mon", from: "19:00", to: "20:30" });
  addClassTime(db, { classId: salsa.id, weekday: "wed", from: "18:00", to: "19:00" });
  addClassTime(db, { classId: hidden.id, weekday: "tue", from: "18:00", to: "19:00" });
  hideClass(db, hidden.id);
});

test("the home page shows the visible classes and their times in order", async ({ page }, testInfo) => {
  await page.goto("/en");
  const cards = page.locator("#classes article", { hasText: tag });
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByRole("heading")).toHaveText(`Salsa ${tag}`);
  await expect(cards.nth(1)).toContainText("All levels");
  const rows = page.locator("#schedule [class*=row]", { hasText: tag });
  await expect(rows).toHaveText([
    new RegExp(`${en.HomePage.schedule.days.mon}Salsa ${tag}19:00–20:30Beginners`),
    new RegExp(`${en.HomePage.schedule.days.wed}Salsa ${tag}18:00–19:00`),
    new RegExp(`${en.HomePage.schedule.days.wed}Kizomba ${tag}20:00–21:00`),
  ]);
  await expect(page.getByText(`Hidden ${tag}`)).toHaveCount(0);
  await page.screenshot({ path: `out/screenshots/home-schedule-${testInfo.project.name}.png`, fullPage: true });

  await page.goto("/nl");
  await expect(page.locator("#classes")).toContainText(`Salsa NL ${tag}`);
  await expect(page.locator("#classes")).toContainText(`Kizomba ${tag}`);
  await expect(page.locator("#schedule [class*=row]", { hasText: `Kizomba ${tag}` })).toContainText(
    `${nl.HomePage.schedule.days.wed}`,
  );
  await expect(page.locator("#classes")).toContainText("Alle niveaus");
});

test("with no visible class each section shows its placeholder line", async ({ page }) => {
  const visible = listClasses(db, { visibleOnly: true });
  for (const cls of visible) hideClass(db, cls.id);
  try {
    await page.goto("/en");
    await expect(page.locator("#classes")).toContainText(en.HomePage.classes.none);
    await expect(page.locator("#schedule")).toContainText(en.HomePage.schedule.none);
    await expect(page.locator("#classes article")).toHaveCount(0);
  } finally {
    for (const cls of visible) db.update(classes).set({ visible: true }).where(eq(classes.id, cls.id)).run();
  }
});
