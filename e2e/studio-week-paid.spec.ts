// The week page shows which approved bookings are paid (#141).
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { markPaid } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("a paid booking shows paid, an unpaid approved booking shows approved", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the week is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "rental", minutes: 60, priceCents: 4141, position: 141 });
  const add = (name: string, iso: string) => {
    const start = DateTime.fromISO(iso, { zone: TIME_ZONE });
    return db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: start.toMillis(),
        end: start.plus({ minutes: 60 }).toMillis(),
        name,
        email: "dancer@example.test",
        phone: "+31 6 1234 5678",
        locale: "en",
        status: "approved",
        createdAt: Date.now(),
      })
      .returning({ id: bookings.id })
      .get();
  };
  // A Thursday and a Friday far in the future: no other test books them.
  const paid = add("Paid Dancer", "2032-04-15T10:00");
  add("Unpaid Dancer", "2032-04-16T10:00");
  expect(markPaid(db, paid.id).ok).toBe(true);

  await page.goto("/studio/week?start=2032-04-15");
  const paidDay = page.locator('section[data-day="2032-04-15"]');
  await expect(paidDay.getByText("Paid Dancer")).toBeVisible();
  await expect(paidDay.getByText(en.StudioWeek.paid, { exact: true })).toBeVisible();
  const unpaidDay = page.locator('section[data-day="2032-04-16"]');
  await expect(unpaidDay.getByText(en.StudioWeek.approved, { exact: true })).toBeVisible();
  await expect(unpaidDay.getByText(en.StudioWeek.paid, { exact: true })).toHaveCount(0);
});
