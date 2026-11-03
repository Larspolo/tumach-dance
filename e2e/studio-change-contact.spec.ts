// Nina corrects the name of a booking from the week page on her phone (#759); a wrong email changes nothing.

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
  test(`Nina corrects the name of a booking and a wrong email changes nothing (${lang})`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
    const db = openDb("out/e2e/tumach.db");
    const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4359, position: 96, visible: false });
    const free = bookingDays(db, offer).filter((day) => day.slots.length > 1);
    test.skip(free.length < 3, "the test needs open hours");
    // The last free time of a later free day: other tests book the first times (#313).
    const day = free[lang === "en" ? 2 : 1];
    const slot = day.slots[day.slots.length - 1];
    const email = `fix-${lang}-${Date.now()}@example.test`;
    const booking = db
      .insert(bookings)
      .values({
        offerId: offer.id,
        priceCents: offer.priceCents,
        start: slot.start,
        end: slot.start + 60 * 60_000,
        name: `Fiks Typo ${lang}`,
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
    let item = page.locator("li", { hasText: `Fiks Typo ${lang}` });
    await item.getByRole("link", { name: m.StudioWeek.fix, exact: true }).click();
    const form = page.locator(`form[data-fix="${booking.id}"]`);
    await expect(form.getByLabel(m.StudioWeek.lessonEmail)).toHaveValue(email);
    await form.getByLabel(m.StudioWeek.lessonName).fill(`Fix Typo ${lang}`);
    await page.screenshot({ path: `out/screenshots/studio-week-change-contact-${lang}.png`, fullPage: true });
    await form.getByRole("button", { name: m.StudioWeek.fixSave }).click();
    item = page.locator("li", { hasText: `Fix Typo ${lang}` });
    await expect(item).toBeVisible();
    await expect(page.locator(`form[data-fix="${booking.id}"]`)).toHaveCount(0);

    // A wrong email: the panel shows the error and the old email stays.
    await item.getByRole("link", { name: m.StudioWeek.fix, exact: true }).click();
    // The browser checks type="email" too: turn its check off to reach the check of the server.
    await form.evaluate((f) => f.setAttribute("novalidate", ""));
    await form.getByLabel(m.StudioWeek.lessonEmail).fill("fix@wrong");
    await form.getByRole("button", { name: m.StudioWeek.fixSave }).click();
    await expect(page.getByText(m.StudioWeek.fixWrongEmail)).toBeVisible();
    await page.screenshot({ path: `out/screenshots/studio-week-change-contact-wrong-${lang}.png`, fullPage: true });
    expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.email).toBe(email);
  });
}
