// A dancer moves a waiting request with the link of the email on a phone (#648): the link page, a day, a time and
// the confirm button (4 taps). The old time is free again, the dancer gets one move email, and the page has no
// serious axe barrier.
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { cancelUrl } from "../src/lib/booking-cancel";
import { bookingDays } from "../src/lib/booking-page";

const LOG = "out/e2e/email.log";
const emailsTo = (to: string) =>
  readFileSync(LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { to: string; subject: string })
    .filter((email) => email.to === to);

test("the dancer moves a waiting request in 4 taps, and the old time is free again", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the dancer opens the email on a phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  // A hidden offer: the home page and the booking page of other tests do not show it.
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4322, position: 93, visible: false });
  // Not the first days (the notice) and not the days of the move test of Nina (#411) or the last days (#313).
  const free = bookingDays(db, offer).filter((day) => day.slots.length > 2);
  test.skip(free.length < 6, "the test needs open hours on 6 days");
  const [from, target] = [free[3], free[4]];
  const slot = from.slots[Math.floor(from.slots.length / 2)];
  const email = `move-link-${Date.now()}@example.test`;
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: offer.priceCents,
      start: slot.start,
      end: slot.end,
      name: "Link Mover",
      email,
      phone: "+31 6 1234 5678",
      locale: "en",
      status: "requested",
      createdAt: Date.now(),
    })
    .returning()
    .get();
  const row = () => db.select().from(bookings).where(eq(bookings.id, booking.id)).get();
  const link = new URL(cancelUrl("http://localhost:3100", booking));

  await page.goto(`${link.pathname}${link.search}`);
  await page.getByRole("link", { name: en.CancelBooking.move }).click(); // tap 1
  await expect(page.getByRole("heading", { name: en.MoveBooking.title })).toBeVisible();
  await page.screenshot({ path: "out/screenshots/booking-move-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/booking-move-laptop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const axe = await new AxeBuilder({ page }).exclude("nav").analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await page.locator(`a[href*="day=${target.date}"]`).first().click(); // tap 2
  const to = target.slots[Math.floor(target.slots.length / 2)];
  await page.locator(`a[href*="to=${to.start}"]`).click(); // tap 3
  await page.screenshot({ path: "out/screenshots/booking-move-confirm-phone.png", fullPage: true });
  await page.getByRole("button", { name: en.MoveBooking.yes }).click(); // tap 4
  await expect(page.getByText(en.MoveBooking.done)).toBeVisible();

  expect(row()?.start).toBe(to.start);
  expect(row()?.status).toBe("requested");
  // The booking page offers the old time again.
  const day = bookingDays(db, offer).find((d) => d.date === from.date);
  expect(day?.slots.some((s) => s.start === slot.start)).toBe(true);
  await expect.poll(() => emailsTo(email).length).toBe(1);
  // Leave no extra request on the requests page of Nina: later tests tab through it (whatsapp-tap.spec.ts).
  db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, booking.id)).run();
});
