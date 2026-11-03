// The note of a dancer in Nina's app on a phone (#388): on the page of the bookings and, cut short, on the week page.
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION, viewport: { width: 390, height: 844 } });

const NOTE = `First time on heels.\nMy left knee is a bit weak. ${"Thank you! ".repeat(8)}`;

test("a request with a note shows the note on the bookings and the week page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5119, position: 94 });
  // A Thursday far in the future: no other test books it.
  const start = DateTime.fromISO("2031-07-10T15:00", { zone: TIME_ZONE });
  const values = {
    offerId: offer.id,
    priceCents: offer.priceCents,
    end: 0,
    email: "note@example.test",
    phone: "+31 6 1234 5678",
    locale: "en",
    status: "requested" as const,
    createdAt: Date.now(),
  };
  db.insert(bookings)
    .values([
      { ...values, start: start.toMillis(), end: start.plus({ hours: 1 }).toMillis(), name: "Note Dancer", note: NOTE },
      {
        ...values,
        start: start.plus({ hours: 2 }).toMillis(),
        end: start.plus({ hours: 3 }).toMillis(),
        name: "",
        email: "",
        phone: "",
        note: "Removed note",
        forgottenAt: Date.now(),
      },
    ])
    .run();

  await page.goto("/studio/bookings");
  const item = page.locator("li").filter({ hasText: "Note Dancer" });
  await expect(item).toContainText("First time on heels.");
  await expect(item).toContainText("Thank you! Thank you!");
  await expect(page.getByText("Removed note")).toHaveCount(0);
  await item.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "out/screenshots/studio-note-bookings-phone.png" });

  await page.goto("/studio/week?start=2031-07-10");
  const day = page.locator('section[data-day="2031-07-10"]');
  const note = day.locator("[data-note]");
  await expect(note).toHaveCount(1);
  await expect(note).toContainText("First time on heels.");
  await expect(note).toContainText("…");
  await expect(day.getByText("Removed note")).toHaveCount(0);
  await day.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "out/screenshots/studio-note-week-phone.png" });
});
