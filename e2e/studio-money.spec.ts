// Nina opens the money of the current month on a phone (#597).
import { expect, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { currentMonth, monthMoney } from "../src/lib/money";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("the tile opens the money page with the approved bookings, the paid and the open sum", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  // The database is shared by the tests: compare with the sums before the two bookings of this test.
  const month = currentMonth();
  const before = monthMoney(db, month);
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5975, position: 597 });
  const first = DateTime.now().setZone(TIME_ZONE).startOf("month").set({ hour: 10 });
  const ids: number[] = [];
  for (const [i, paid] of [true, false].entries()) {
    const start = first.plus({ hours: i * 2 });
    const row = db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: start.toMillis(),
        end: start.plus({ minutes: 60 }).toMillis(),
        priceCents: paid ? 5975 : 3125,
        name: `Money ${Date.now()} ${i}`,
        email: "dancer@example.test",
        phone: "+31 6 1234 5678",
        locale: "en",
        status: "approved",
        createdAt: Date.now(),
        paidAt: paid ? Date.now() : null,
      })
      .returning({ id: bookings.id })
      .get();
    ids.push(row.id);
  }
  // The database is shared: remove the bookings at the end, else their "Undo" (paid) buttons confuse other tests.

  try {
    const euro = new Intl.NumberFormat("en", { style: "currency", currency: "EUR" });

    await page.goto("/studio");
    await page.getByRole("link", { name: en.StudioHome.money, exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/money$/);
    await expect(page.getByTestId("money-count")).toHaveText(String(before.count + 2));
    await expect(page.getByTestId("money-paid")).toHaveText(euro.format((before.paidCents + 5975) / 100));
    await expect(page.getByTestId("money-open")).toHaveText(euro.format((before.openCents + 3125) / 100));
    await page.screenshot({ path: "out/screenshots/studio-money-phone.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-money-desktop.png", fullPage: true });
  } finally {
    db.delete(bookings).where(inArray(bookings.id, ids)).run();
  }
});
