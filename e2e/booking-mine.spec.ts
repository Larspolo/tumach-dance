// A dancer opens the next bookings from the token of one booking on a phone (#743), in English and Dutch.
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { requestEmail } from "../src/lib/booking-email";
import { TIME_ZONE } from "../src/lib/hours";

test.beforeEach(({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the dancer opens the email on a phone");
  return page.setViewportSize({ width: 390, height: 844 });
});

// The path of the next-bookings link in the request email of a booking (#755).
function mineLink(text: string): string {
  const link = text.match(/https?:\/\/\S+\/booking\/mine\?token=\S+/)?.[0];
  if (!link) throw new Error("the email has no link to the next bookings");
  const url = new URL(link);
  return url.pathname + url.search;
}

function addBookings() {
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 96 });
  const email = `mine-${Date.now()}@example.test`;
  const add = (local: string, status: "requested" | "approved", locale: "en" | "nl") => {
    const start = DateTime.fromISO(local, { zone: TIME_ZONE });
    return db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: start.toMillis(),
        end: start.plus({ minutes: 60 }).toMillis(),
        name: "Mine Dancer",
        email,
        phone: "+31 6 1234 5678",
        locale,
        status,
        priceCents: 6000,
        createdAt: Date.now(),
      })
      .returning()
      .get();
  };
  return { offer, later: add("2033-05-18T15:00", "approved", "nl"), first: add("2033-05-11T15:00", "requested", "en") };
}

test("the page of a token shows the next bookings with their cancel links", async ({ page }) => {
  const { offer, later, first } = addBookings();
  await page.goto(mineLink(requestEmail(first, offer, "en").text));
  await expect(page.getByRole("heading", { name: en.MyBookings.title })).toBeVisible();
  const items = page.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Wednesday, May 11, 2033");
  await expect(items.nth(0)).toContainText(en.MyBookings.requested);
  await expect(items.nth(1)).toContainText(en.MyBookings.approved);
  await expect(items.nth(1).getByRole("link", { name: en.MyBookings.cancel })).toHaveAttribute(
    "href",
    `/en/booking/cancel?token=${later.cancelToken}`,
  );
  await page.screenshot({ path: "out/screenshots/booking-mine-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/booking-mine-laptop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(mineLink(requestEmail(later, offer, "nl").text));
  await expect(page.getByRole("heading", { name: nl.MyBookings.title })).toBeVisible();
  await expect(page.getByRole("link", { name: nl.MyBookings.cancel })).toHaveCount(2);
});

test("a wrong token shows the text with no booking", async ({ page }) => {
  await page.goto("/en/booking/mine?token=wrong");
  await expect(page.getByText(en.MyBookings.none)).toBeVisible();
  await expect(page.getByRole("link", { name: en.MyBookings.book })).toHaveAttribute("href", "/en/book");
});
