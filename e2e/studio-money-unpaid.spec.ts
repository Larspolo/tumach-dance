// Nina marks an unpaid booking of the month paid on the money page (#599).
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { currentMonth, monthMoney } from "../src/lib/money";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("one tap on Mark paid moves an unpaid booking from the list and the open sum to the paid sum", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5990, position: 599 });
  const name = `Unpaid ${Date.now()}`;
  const start = DateTime.now().setZone(TIME_ZONE).startOf("month").set({ hour: 9 });
  const { id } = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      priceCents: 5990,
      name,
      email: "dancer@example.test",
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "approved",
      createdAt: Date.now(),
    })
    .returning({ id: bookings.id })
    .get();
  try {
    const before = monthMoney(db, currentMonth());
    const euro = new Intl.NumberFormat("en", { style: "currency", currency: "EUR" });
    await page.goto("/studio/money");
    const item = page.getByRole("list", { name: en.StudioMoney.unpaidTitle }).locator("li", { hasText: name });
    await expect(item).toBeVisible();
    await expect(item).toContainText(euro.format(59.9));
    await page.screenshot({ path: "out/screenshots/studio-money-unpaid-phone.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-money-unpaid-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });

    await item.getByRole("button", { name: en.StudioBookings.markPaid, exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/money$/);
    await expect(page.locator("li", { hasText: name })).toHaveCount(0);
    await expect(page.getByTestId("money-paid")).toHaveText(euro.format((before.paidCents + 5990) / 100));
    await expect(page.getByTestId("money-open")).toHaveText(euro.format((before.openCents - 5990) / 100));
    expect(db.select().from(bookings).where(eq(bookings.id, id)).get()?.paidAt).not.toBeNull();
  } finally {
    // The database is shared: a paid booking adds an "Undo" button on the bookings page of other tests.
    db.delete(bookings).where(eq(bookings.id, id)).run();
  }
});
