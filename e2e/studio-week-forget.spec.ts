// Nina removes the data of a dancer from the week page on a phone in two taps (#363). The coming booking of that
// dancer is cancelled with the cancel email first; the past booking stays in the week as "Name removed".
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("Nina removes the data of a dancer in two taps", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the week is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "rental", minutes: 60, priceCents: 4000, position: 95 });
  const add = (iso: string) => {
    const start = DateTime.fromISO(iso, { zone: TIME_ZONE });
    return db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: start.toMillis(),
        end: start.plus({ minutes: 60 }).toMillis(),
        name: "Forget Dancer",
        email: "forget-dancer@example.test",
        phone: "+31 6 1234 5678",
        locale: "en",
        status: "approved",
        createdAt: Date.now(),
      })
      .returning()
      .get();
  };
  // A past Thursday and a Thursday far in the future: no other test books them (#333).
  const past = add("2020-03-12T15:00");
  const coming = add("2033-04-07T15:00");

  await page.goto("/studio/week?start=2020-03-12");
  const day = page.locator('section[data-day="2020-03-12"]');
  await expect(day.getByText("Forget Dancer")).toBeVisible();
  await day.getByRole("link", { name: en.StudioWeek.forget, exact: true }).click();
  await expect(day.getByText(en.StudioWeek.forgetAsk)).toBeVisible();
  await page.screenshot({ path: "out/screenshots/studio-week-forget-phone.png", fullPage: true });
  await day.getByRole("button", { name: en.StudioWeek.forgetYes }).click();

  await expect(page).toHaveURL(/\/studio\/week\?start=2020-03-09$/);
  await expect(day.getByText(en.StudioWeek.removed)).toBeVisible();
  await expect(page.getByText("Forget Dancer")).toHaveCount(0);
  await expect(day.getByRole("link", { name: en.StudioWeek.forget, exact: true })).toHaveCount(0);
  const row = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get();
  expect(row(past.id)?.email).toBe("");
  expect(row(coming.id)?.status).toBe("cancelled");
  expect(row(coming.id)?.email).toBe("");
  await expect.poll(() => readFileSync("out/e2e/email.log", "utf8")).toContain("forget-dancer@example.test");
});
