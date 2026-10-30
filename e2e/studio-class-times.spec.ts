// The weekly times of a class on a phone (#97): the session of `studio.setup.ts`, add a time, a wrong time, remove.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("Nina adds Tuesday 19:00 to 20:30 to a class and removes it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the classes are for the phone");
  const t = en.StudioClasses;
  await page.goto("/studio/classes");
  const name = `Bachata ${Date.now()}`;
  await page.getByText(t.add, { exact: true }).click();
  const addForm = page.locator("form", { has: page.getByRole("button", { name: t.addSave, exact: true }) });
  await addForm.getByLabel(t.name, { exact: true }).fill(name);
  await addForm.getByRole("textbox", { name: t.text, exact: true }).fill("Close and slow.");
  await addForm.getByLabel(t.forWhom, { exact: true }).fill("All");
  await addForm.getByRole("button", { name: t.addSave, exact: true }).click();

  const cls = page.locator("li > details", { has: page.locator("summary", { hasText: name }) });
  await expect(cls).toHaveCount(1);
  if (!(await cls.evaluate((el) => (el as HTMLDetailsElement).open))) await cls.locator(":scope > summary").click();
  await expect(cls.getByText(t.noTimes)).toBeVisible();

  await cls.getByLabel(t.weekday).selectOption("tue");
  await cls.getByLabel(t.start).fill("19:00");
  await cls.getByLabel(t.end).fill("18:00");
  await cls.getByRole("button", { name: t.addTime }).click();
  await expect(cls.getByText(t.wrongTime)).toBeVisible();
  // A wrong time keeps the values that Nina typed.
  await expect(cls.getByLabel(t.weekday)).toHaveValue("tue");
  await expect(cls.getByLabel(t.start)).toHaveValue("19:00");

  await cls.getByLabel(t.end).fill("20:30");
  await cls.getByRole("button", { name: t.addTime }).click();
  const line = cls.getByText("Tuesday 19:00 to 20:30");
  await expect(line).toBeVisible();
  await page.screenshot({ path: "out/screenshots/studio-class-times-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-class-times-laptop.png", fullPage: true });

  await cls.getByRole("button", { name: t.removeTime }).click();
  await expect(line).toHaveCount(0);
});
