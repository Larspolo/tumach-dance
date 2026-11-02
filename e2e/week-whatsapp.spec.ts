// The week page shows the WhatsApp link of a booking with a phone number, and none for a removed dancer (#497).
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("an approved booking has a WhatsApp link, a removed dancer has none", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the week is for the phone");
  await page.setViewportSize({ width: 390, height: 844 });
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4242, position: 142 });
  const add = (name: string, iso: string, extra: { phone: string; forgottenAt: number | null }) => {
    const start = DateTime.fromISO(iso, { zone: TIME_ZONE });
    db.insert(bookings)
      .values({
        offerId: offer.id,
        priceCents: offer.priceCents,
        start: start.toMillis(),
        end: start.plus({ minutes: 60 }).toMillis(),
        name,
        email: extra.forgottenAt === null ? "dancer@example.test" : "",
        phone: extra.phone,
        locale: "en",
        status: "approved",
        createdAt: Date.now(),
        forgottenAt: extra.forgottenAt,
      })
      .run();
  };
  // A Tuesday and a Wednesday far in the future: no other test books them.
  add("Wa Week", "2033-06-07T10:00", { phone: "+31 6 1234 5678", forgottenAt: null });
  add("Removed Dancer", "2033-06-08T10:00", { phone: "", forgottenAt: Date.now() });

  await page.goto("/studio/week?start=2033-06-07");
  const withLink = page.locator('section[data-day="2033-06-07"]');
  const link = withLink.getByRole("link", { name: "WhatsApp" });
  await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/31612345678\?text=/);
  const removed = page.locator('section[data-day="2033-06-08"]');
  await expect(removed.getByText(en.StudioWeek.removed)).toBeVisible();
  await expect(removed.getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
});
