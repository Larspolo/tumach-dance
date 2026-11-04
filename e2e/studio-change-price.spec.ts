// Nina changes the price of one booking from the week page on her phone (#761): the week and the money page show it.

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingDays } from "../src/lib/booking-page";
import { weekOf } from "../src/lib/week";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

for (const [lang, m] of [
  ["en", en],
  ["nl", nl],
] as const) {
  test(`Nina changes the price of a booking (${lang})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
    const db = openDb("out/e2e/tumach.db");
    const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4361, position: 95, visible: false });
    const free = bookingDays(db, offer).filter((day) => day.slots.length > 1);
    test.skip(free.length < 3, "the test needs open hours");
    // The last free time of a later free day: other tests book the first times (#313).
    const day = free[lang === "en" ? 2 : 1];
    const slot = day.slots[day.slots.length - 2];
    const email = `price-${lang}-${Date.now()}@example.test`;
    const booking = db
      .insert(bookings)
      .values({
        offerId: offer.id,
        priceCents: offer.priceCents,
        start: slot.start,
        end: slot.start + 60 * 60_000,
        name: `Price Duo ${lang}`,
        email,
        phone: "",
        locale: lang,
        status: "approved",
        approvedAt: Date.now(),
        createdAt: Date.now(),
      })
      .returning()
      .get();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio");
    await page.evaluate((l) => {
      // biome-ignore lint/suspicious/noDocumentCookie: the same plain cookie as the language control sets.
      document.cookie = `NEXT_LOCALE=${l}; path=/`;
    }, lang);
    await page.goto(`/studio/week?start=${weekOf(day.date).start}`);
    const item = page.locator("li", { hasText: `Price Duo ${lang}` });
    await item.getByRole("link", { name: m.StudioWeek.fix, exact: true }).click();
    const form = page.locator(`form[data-fix="${booking.id}"]`);
    await expect(form.getByLabel(m.StudioWeek.fixPrice)).toHaveValue("43.61");
    await form.getByLabel(m.StudioWeek.fixPrice).fill("87,22");
    await page.screenshot({ path: `out/screenshots/studio-week-change-price-${lang}.png`, fullPage: true });
    await form.getByRole("button", { name: m.StudioWeek.fixSave }).click();
    await expect(page.locator(`form[data-fix="${booking.id}"]`)).toHaveCount(0);
    const euro = new Intl.NumberFormat(lang, { style: "currency", currency: "EUR" }).format(87.22);
    await expect(item.locator("[data-price]")).toHaveText(euro);
    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.priceCents).toBe(8722);

    await page.goto(`/studio/money?month=${day.date.slice(0, 7)}`);
    const unpaid = page.locator("li", { hasText: `Price Duo ${lang}` });
    await expect(unpaid).toContainText(euro);
    await page.screenshot({ path: `out/screenshots/studio-money-change-price-${lang}.png`, fullPage: true });
  });
}
