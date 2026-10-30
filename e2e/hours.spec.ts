// Nina sets her weekly hours on her phone (#23).
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { logIn } from "./studio-session";

const h = en.StudioHours;

test("the hours page needs a login", async ({ page }) => {
  await page.goto("/studio/hours");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test("Nina sets weekends all day, weekdays from 17:00, not on Thursday", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the hours are set on a phone");
  await logIn(page);
  await page.getByRole("link", { name: en.StudioHome.hours }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(h.title);
  const weekdays = page.getByRole("group", { name: h.weekdays });
  const weekend = page.getByRole("group", { name: h.weekend });

  // First all closed, so that the rule below is a real change.
  await weekdays.getByLabel(h.closed).check();
  await weekend.getByLabel(h.closed).check();
  await page.getByRole("button", { name: h.save }).click();
  await expect(page.getByText(h.saved)).toBeVisible();
  await expect(page.getByText(h.noOpenTimes)).toBeVisible();

  // A wrong rule: an empty time. The stored rule stays.
  await weekdays.getByLabel(h.from, { exact: true }).check();
  await weekdays.getByLabel(h.fromTime, { exact: true }).fill("");
  await page.getByRole("button", { name: h.save }).click();
  await expect(page.getByText(h.wrong)).toBeVisible();
  await expect(page.getByText(h.noOpenTimes)).toBeVisible();

  // The rule of P1 in 6 taps and inputs.
  await weekend.getByLabel(h.allDay).check();
  await weekdays.getByLabel(h.from, { exact: true }).check();
  await weekdays.getByLabel(h.fromTime, { exact: true }).fill("17:00");
  await weekdays.getByLabel(h.day.thu).uncheck();
  await page.getByRole("button", { name: h.save }).click();
  await expect(page.getByText(h.saved)).toBeVisible();

  await page.reload();
  await expect(weekend.getByLabel(h.allDay)).toBeChecked();
  await expect(weekdays.getByLabel(h.from, { exact: true })).toBeChecked();
  await expect(weekdays.getByLabel(h.fromTime, { exact: true })).toHaveValue("17:00");
  await expect(weekdays.getByLabel(h.day.thu)).not.toBeChecked();
  const list = page.getByRole("list", { name: h.nextWeek });
  await expect(list.getByRole("listitem")).toHaveCount(6);
  await expect(list).not.toContainText("Thursday");
  await expect(list).toContainText("Saturday");
  await page.screenshot({ path: "out/screenshots/studio-hours-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-hours-laptop.png", fullPage: true });
});
