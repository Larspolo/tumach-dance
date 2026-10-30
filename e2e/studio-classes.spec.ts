// The classes of the studio app on a phone (#96): the session of `studio.setup.ts`, add, change and hide.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test("without a session the classes page goes to the login page", async ({ page }) => {
  await page.goto("/studio/classes");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test.describe("with a session", () => {
  test.use({ storageState: STUDIO_SESSION });

  test("Nina adds a class, changes its text and hides it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the classes are for the phone");
    await page.goto("/studio");
    await page.getByRole("link", { name: en.StudioHome.classes }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioClasses.title);

    const name = `Salsa ${Date.now()}`;
    const t = en.StudioClasses;
    await page.getByText(t.add, { exact: true }).click();
    const addForm = page.locator("form", { has: page.getByRole("button", { name: t.addSave, exact: true }) });
    await addForm.getByLabel(t.name, { exact: true }).fill(name);
    await addForm.getByLabel(t.text, { exact: true }).fill("Turns and fun.");
    await addForm.getByLabel(t.forWhom, { exact: true }).fill("Beginners");
    await addForm.getByText(t.translations).click();
    await addForm.getByLabel(t.nameIn.replace("{language}", t.nl)).fill(`${name} NL`);
    await addForm.getByRole("button", { name: t.addSave, exact: true }).click();

    const cls = page.locator("li > details", { has: page.locator("summary", { hasText: name }) });
    await expect(cls).toHaveCount(1);
    // The details can stay open after a submit: open it only when it is closed.
    const open = async () => {
      if (!(await cls.evaluate((el) => (el as HTMLDetailsElement).open))) await cls.locator(":scope > summary").click();
    };
    await open();
    await cls.getByRole("textbox", { name: t.text, exact: true }).fill("A new text.");
    await cls.getByRole("button", { name: t.save }).click();
    await expect(cls.getByRole("textbox", { name: t.text, exact: true })).toHaveValue("A new text.");

    await open();
    await cls.getByRole("button", { name: t.hide }).click();
    await expect(cls.locator(":scope > summary")).toContainText(t.hidden);
    await page.screenshot({ path: "out/screenshots/studio-classes-phone.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-classes-laptop.png", fullPage: true });
  });
});
