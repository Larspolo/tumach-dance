// The first line of Nina's private note about a dancer shows with each booking of that dancer on the week page and the
// bookings page, and a tap opens the page of the dancer (#697, epic #691).

import { expect, test } from "@playwright/test";
import { openDb } from "../src/db";
import { setDancerNote } from "../src/db/dancer-notes";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { weekOf } from "../src/lib/week";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("the first line of the note shows on the week and bookings pages, and a tap opens the dancer", async ({
  page,
}, testInfo) => {
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4321, position: 97, visible: false });
  const email = `note-line-${Date.now()}@example.test`;
  // An approved booking in the next days: on the week page and on the bookings page (30 days back to 90 ahead).
  const start = Date.now() + 3 * 86_400_000;
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start,
      end: start + 60 * 60_000,
      name: "Line Dancer",
      email,
      phone: "",
      locale: "en",
      status: "approved",
      approvedAt: Date.now(),
      createdAt: Date.now(),
    })
    .returning()
    .get();
  const line = `Works on spins, bring her own mat. ${booking.id}`;
  // The text is unique per run: the database of the test keeps the bookings of the other project.
  setDancerNote(db, booking, `${line}\nSecond line that is not shown`, Date.now());

  await page.goto(`/studio/week?start=${weekOf(new Date(start).toISOString().slice(0, 10)).start}`);
  const weekLine = page.getByRole("link", { name: line });
  await expect(weekLine).toBeVisible();
  await page.screenshot({
    path: `out/screenshots/studio-dancer-note-line-week-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await weekLine.click();
  await expect(page).toHaveURL(new RegExp(`/studio/dancer/${booking.id}`));

  await page.goto("/studio/bookings");
  await expect(page.getByRole("link", { name: line })).toBeVisible();
  await expect(page.getByText("Second line that is not shown")).toHaveCount(0);
});
