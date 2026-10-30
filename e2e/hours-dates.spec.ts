// Nina closes dates and opens an extra day on her phone (#24).
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

const h = en.StudioHours;
test.use({ storageState: STUDIO_SESSION });

test("Nina closes a date and a period, opens an extra day, and removes them", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the dates are set on a phone");
  const today = DateTime.now().setZone("Europe/Amsterdam").startOf("day");
  const day = (n: number) => today.plus({ days: n });
  const name = (d: DateTime) => d.setLocale("en").toFormat("cccc");
  await page.goto("/studio/hours");
  const list = page.getByRole("list", { name: h.nextWeek });
  const closedList = page.getByRole("list", { name: h.closedDates });
  const extraList = page.getByRole("list", { name: h.extraDays });

  // Open all week but one weekday outside the period below (days 1, 5 and 6 have at least one weekday): weekdays from 17:00 without the weekday of day 1, weekend all day.
  const weekdays = page.getByRole("group", { name: h.weekdays });
  const weekend = page.getByRole("group", { name: h.weekend });
  const shut = day([1, 5, 6].find((n) => day(n).weekday <= 5) ?? 1);
  await weekdays.getByLabel(h.from, { exact: true }).check();
  await weekdays.getByLabel(h.fromTime, { exact: true }).fill("17:00");
  for (const d of ["mon", "tue", "wed", "thu", "fri"] as const) await weekdays.getByLabel(h.day[d]).check();
  await weekdays.getByLabel(h.day[(["mon", "tue", "wed", "thu", "fri"] as const)[shut.weekday - 1]]).uncheck();
  await weekend.getByLabel(h.allDay).check();
  await page.getByRole("button", { name: h.save }).click();
  await expect(page.getByText(h.saved)).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(6);
  await expect(list).not.toContainText(name(shut));

  const closeForm = page.getByRole("form", { name: h.closedDates });
  const extraForm = page.getByRole("form", { name: h.extraDays });

  // A period whose end is before its start: a message, and no change.
  await closeForm.getByLabel(h.closedFrom).fill(day(4).toISODate() ?? "");
  await closeForm.getByLabel(h.closedTo).fill(day(2).toISODate() ?? "");
  await closeForm.getByRole("button", { name: h.close }).click();
  await expect(page.getByText(h.wrongPeriod)).toBeVisible();
  await expect(closedList.getByRole("listitem")).toHaveText([h.none]);
  await expect(list.getByRole("listitem")).toHaveCount(6);

  // One date (today), then a period of 3 days (days 2 to 4).
  await closeForm.getByLabel(h.closedFrom).fill(today.toISODate() ?? "");
  await closeForm.getByLabel(h.closedTo).fill("");
  await closeForm.getByRole("button", { name: h.close }).click();
  await expect(list.getByRole("listitem")).toHaveCount(5);
  await closeForm.getByLabel(h.closedFrom).fill(day(2).toISODate() ?? "");
  await closeForm.getByLabel(h.closedTo).fill(day(4).toISODate() ?? "");
  await closeForm.getByRole("button", { name: h.close }).click();
  await expect(closedList.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("listitem")).toHaveCount(2); // days 1, 5 and 6, without the closed weekday
  await expect(list).not.toContainText(name(day(3)));

  // An extra day on the closed weekday, from 10:00.
  await extraForm.getByLabel(h.extraDate).fill(shut.toISODate() ?? "");
  await extraForm.getByLabel(h.from, { exact: true }).check();
  await extraForm.getByLabel(h.fromTime, { exact: true }).fill("10:00");
  await extraForm.getByRole("button", { name: h.openDay }).click();
  await expect(extraList.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText(name(shut));
  await expect(list.getByRole("listitem").filter({ hasText: name(shut) })).toContainText("10:00");
  await page.screenshot({ path: "out/screenshots/studio-hours-dates-phone.png", fullPage: true });

  // Remove each: the old times come back.
  const removes = page.getByRole("button", { name: new RegExp(`^${h.remove}: `) });
  for (let count = 3; count > 0; count--) {
    await removes.first().click();
    await expect(removes).toHaveCount(count - 1);
  }
  await expect(list.getByRole("listitem")).toHaveCount(6);
  await expect(list).not.toContainText(name(shut));
});
