// Nina writes, changes and removes her private note about a dancer on the page of that dancer (#696, epic #691): the
// note shows on the page of another booking of the same dancer too.

import { expect, test } from "@playwright/test";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION });

test("Nina writes, changes and removes a note about a dancer; another booking shows the same note", async ({
  page,
}, testInfo) => {
  const db = openDb("out/e2e/tumach.db");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4321, position: 96, visible: false });
  const email = `note-${Date.now()}@example.test`;
  const row = (at: number) => ({
    offerId: offer.id,
    priceCents: offer.priceCents,
    start: at,
    end: at + 60 * 60_000,
    name: "Note Dancer",
    email,
    phone: "",
    locale: "en",
    status: "approved" as const,
    approvedAt: Date.now(),
    createdAt: Date.now(),
  });
  const base = Date.UTC(2031, 0, 6, 9);
  const first = db.insert(bookings).values(row(base)).returning().get();
  const second = db
    .insert(bookings)
    .values(row(base + 7 * 86_400_000))
    .returning()
    .get();

  const field = page.locator("[data-dancer-note] textarea");
  const save = page.locator("[data-dancer-note]").getByRole("button", { name: "Save", exact: true });

  // Save, wait for the server action to answer, then load the page again: the value must come from the database.
  const saveNote = async (text: string, bookingId: number) => {
    await field.fill(text);
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), save.click()]);
    await page.goto(`/studio/dancer/${bookingId}`);
  };

  await page.goto(`/studio/dancer/${first.id}`);
  await expect(field).toHaveValue("");
  await field.fill("Likes the back row.");
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), save.click()]);
  await page.screenshot({ path: `out/screenshots/studio-dancer-note-${testInfo.project.name}.png`, fullPage: true });
  await page.goto(`/studio/dancer/${first.id}`);
  await expect(field).toHaveValue("Likes the back row.");

  await page.goto(`/studio/dancer/${second.id}`);
  await expect(field).toHaveValue("Likes the back row.");

  await saveNote("Bring her own mat.", second.id);
  await expect(field).toHaveValue("Bring her own mat.");
  await page.goto(`/studio/dancer/${first.id}`);
  await expect(field).toHaveValue("Bring her own mat.");

  await saveNote("", first.id);
  await expect(field).toHaveValue("");
  await page.goto(`/studio/dancer/${second.id}`);
  await expect(field).toHaveValue("");
});
