// Nina's private note about a dancer never shows on a public page (#710, epic #691): the cancel link page and the move
// page of the dancer, in English and Dutch, do not contain the text of the note.
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { openDb } from "../src/db";
import { setDancerNote } from "../src/db/dancer-notes";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { cancelUrl } from "../src/lib/booking-cancel";
import { TIME_ZONE } from "../src/lib/hours";

const NOTE = `PRIVATE-NOTE-710-${Date.now()}`;

function addBookingWithNote(start: DateTime, email: string, locale: "en" | "nl") {
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 94 });
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start: start.toMillis(),
      end: start.plus({ minutes: 60 }).toMillis(),
      name: "Public Dancer",
      email,
      phone: "+31 6 4444 5555",
      locale,
      status: "approved",
      createdAt: Date.now(),
    })
    .returning()
    .get();
  expect(setDancerNote(db, booking, NOTE, Date.now()).ok).toBe(true);
  return new URL(cancelUrl("http://localhost:3100", booking));
}

for (const locale of ["en", "nl"] as const) {
  test(`the note of a dancer is not on the cancel or move page (${locale})`, async ({ page }) => {
    // A Thursday far in the future: no other test books it.
    const start = DateTime.fromISO(`2032-04-0${locale === "en" ? 1 : 2}T15:00`, { zone: TIME_ZONE });
    const link = addBookingWithNote(start, `public-note-${locale}@example.test`, locale);
    const token = link.searchParams.get("token") ?? "";

    const cancel = await page.goto(`/${locale}/booking/cancel?${new URLSearchParams({ token })}`);
    expect(cancel?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(NOTE);

    const move = await page.goto(`/${locale}/booking/move?${new URLSearchParams({ token })}`);
    expect(move?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(NOTE);
    expect(await page.content()).not.toContain(NOTE);
  });
}
