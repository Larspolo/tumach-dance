// Nina sees the money of the year on the money page, on a phone (#627).
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { currentMonth, yearMoney } from "../src/lib/money";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("the money page shows the three totals of the year under the totals of the month", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  // The database is shared by the tests: compare with the sums before the booking of this test.
  const year = Number(currentMonth().slice(0, 4));
  const before = yearMoney(db, year);
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4425, position: 627 });
  const start = DateTime.now().setZone(TIME_ZONE).startOf("year").plus({ days: 1 }).set({ hour: 10 });
  const row = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      priceCents: 4425,
      name: `Year ${Date.now()}`,
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
    const euro = new Intl.NumberFormat("en", { style: "currency", currency: "EUR" });
    await page.goto(`/studio/money?month=${currentMonth()}`);
    await expect(
      page.getByRole("heading", { name: en.StudioMoney.yearTitle.replace("{year}", String(year)) }),
    ).toBeVisible();
    await expect(page.getByTestId("money-year-count")).toHaveText(String(before.count + 1));
    await expect(page.getByTestId("money-year-paid")).toHaveText(euro.format(before.paidCents / 100));
    await expect(page.getByTestId("money-year-open")).toHaveText(euro.format((before.openCents + 4425) / 100));
  } finally {
    db.delete(bookings).where(eq(bookings.id, row.id)).run();
  }
});
