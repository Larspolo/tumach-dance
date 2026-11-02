// A dancer books a lesson on a phone with only the keyboard, and each step shows the focus (#347).
import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import en from "../messages/en.json" with { type: "json" };
import { type Db, openDb } from "../src/db";
import { addOffer, hideOffer, type Offer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

let db: Db;
let offer: Offer;

test.skip(({ isMobile }) => !isMobile, "the booking page is for a phone");

// An unusual price finds the offer of this test; position 0 makes it the first offer.
test.beforeAll(() => {
  db = openDb("out/e2e/tumach.db");
  offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 4331, position: 0 });
});

test.afterAll(() => {
  db.delete(bookings).where(eq(bookings.offerId, offer.id)).run();
  hideOffer(db, offer.id);
});

// Press Tab until the focused element is the target; expect a visible focus outline on it.
async function tabTo(page: Page, isTarget: string, arg?: string) {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate(
      ([fn, a]) => new Function("el", "arg", `return (${fn})(el, arg)`)(document.activeElement, a) as boolean,
      [isTarget, arg ?? ""],
    );
    if (hit) {
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
      expect(outline).not.toBe("none");
      return;
    }
  }
  throw new Error(`no focus on the target: ${isTarget}`);
}

const inSection = `(el, heading) => {
  const s = el?.closest("section");
  return !!s && s.querySelector("h2")?.textContent === heading;
}`;
const lastInSection = `(el, heading) => {
  const s = el?.closest("section");
  if (!s || s.querySelector("h2")?.textContent !== heading) return false;
  const links = s.querySelectorAll("a");
  return el === links[links.length - 1];
}`;

test("a dancer books a lesson with only the keyboard", async ({ page }) => {
  await page.goto("/en/book");
  await tabTo(page, `(el, price) => el?.tagName === "A" && el.textContent.includes(price)`, "€43.31");
  await page.keyboard.press("Enter");
  await expect(page.locator("section", { hasText: en.Book.day })).toBeVisible();
  await tabTo(page, lastInSection, en.Book.day);
  await page.keyboard.press("Enter");
  await expect(page.locator("section", { hasText: en.Book.time })).toBeVisible();
  await tabTo(page, inSection, en.Book.time);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(en.Book.name)).toBeVisible();
  await tabTo(page, `(el) => el?.getAttribute("name") === "name"`);
  await page.keyboard.type("Kim Keys");
  await page.keyboard.press("Tab");
  await page.keyboard.type("kim@example.test");
  await page.keyboard.press("Tab");
  await page.keyboard.type("+31 6 1111 2222");
  await tabTo(page, `(el) => el?.getAttribute("type") === "submit"`);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.Book.sent);
});
