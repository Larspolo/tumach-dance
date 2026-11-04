// Nina goes to the money of the month after and back on a phone (#598).
import { expect, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { currentMonth, monthMoney } from "../src/lib/money";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("the link of the month after shows its booking, the link back this month", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  const thisMonth = currentMonth();
  const nextStart = DateTime.now().setZone(TIME_ZONE).startOf("month").plus({ months: 1 });
  const nextMonth = nextStart.toFormat("yyyy-MM");
  const beforeThis = monthMoney(db, thisMonth);
  const beforeNext = monthMoney(db, nextMonth);
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5985, position: 598 });
  const start = nextStart.set({ day: 10, hour: 11 });
  const row = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      priceCents: 5985,
      name: `Money months ${Date.now()}`,
      email: "dancer@example.test",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      createdAt: Date.now(),
      paidAt: null,
    })
    .returning({ id: bookings.id })
    .get();
  try {
    await page.goto("/studio/money");
    await expect(page.getByTestId("money-count")).toHaveText(String(beforeThis.count));
    await page.getByTestId("money-next").click();
    await expect(page).toHaveURL(new RegExp(`month=${nextMonth}$`));
    await expect(page.getByTestId("money-count")).toHaveText(String(beforeNext.count + 1));
    await page.screenshot({ path: "out/screenshots/studio-money-months-phone.png", fullPage: true });
    await page.getByTestId("money-previous").click();
    await expect(page).toHaveURL(new RegExp(`month=${thisMonth}$`));
    await expect(page.getByTestId("money-count")).toHaveText(String(beforeThis.count));
    // A wrong month shows the current month.
    await page.goto("/studio/money?month=2026-13");
    await expect(page.getByTestId("money-next")).toHaveAttribute("href", `/studio/money?month=${nextMonth}`);
  } finally {
    db.delete(bookings)
      .where(inArray(bookings.id, [row.id]))
      .run();
  }
});
