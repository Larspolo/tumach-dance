// Nina downloads the spreadsheet of the year from the money page, on a phone (#629).
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { TIME_ZONE } from "../src/lib/hours";
import { currentMonth } from "../src/lib/money";
import { yearCsv } from "../src/lib/money-csv";
import { STUDIO_SESSION } from "./studio-session";

test.describe("with a session", () => {
  test.use({ storageState: STUDIO_SESSION });

  test("a tap on the link downloads the CSV file of the approved bookings of the year", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the studio app is for the phone");
    await page.setViewportSize({ width: 390, height: 844 });
    const db = openDb("out/e2e/tumach.db");
    const year = Number(currentMonth().slice(0, 4));
    const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4629, position: 629 });
    const start = DateTime.now().setZone(TIME_ZONE).startOf("year").plus({ days: 2 }).set({ hour: 11 });
    const row = db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: start.toMillis(),
        end: start.plus({ minutes: 60 }).toMillis(),
        priceCents: 4629,
        name: `Download ${Date.now()}`,
        email: "dancer@example.test",
        phone: "+31 6 1234 5678",
        locale: "en",
        status: "approved",
        createdAt: Date.now(),
        paidAt: null,
      })
      .returning({ id: bookings.id })
      .get();

    try {
      await page.goto(`/studio/money?month=${currentMonth()}`);
      const link = page.getByTestId("money-year-download");
      await expect(link).toHaveText(en.StudioMoney.yearDownload.replace("{year}", String(year)));
      const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
      expect(download.suggestedFilename()).toBe(`tumach-${year}.csv`);
      const text = readFileSync(await download.path(), "utf8");
      const c = en.StudioMoney.csv;
      const expected = yearCsv(db, year, {
        header: [c.date, c.time, c.offer, c.price, c.paid],
        offer: (o) => en.Book[o.kind].replace("{minutes}", String(o.minutes)),
        yes: c.yes,
        no: c.no,
      });
      expect(text).toBe(expected);
      expect(text).toContain(`${start.toFormat("yyyy-MM-dd")};11:00;`);
      expect(text).toContain(";46,29;");
    } finally {
      db.delete(bookings).where(eq(bookings.id, row.id)).run();
    }
  });

  test("a file name that is not a year gives 404", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "one project is enough");
    expect((await request.get("/api/studio/money/abc.csv")).status()).toBe(404);
  });
});

test("a request with no session gets no file", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "one project is enough");
  const response = await request.get("/api/studio/money/2026.csv", { maxRedirects: 0 });
  expect(response.headers()["content-disposition"]).toBeUndefined();
  expect(response.status()).not.toBe(200);
});
