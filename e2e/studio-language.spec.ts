// Nina changes the language inside the studio app, and the choice stays one year (#314).
import { expect, type Page, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

test.use({ storageState: STUDIO_SESSION, viewport: { width: 390, height: 844 }, locale: "en-US" });

const YEAR = 60 * 60 * 24 * 365;

async function localeCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === "NEXT_LOCALE");
}

function choose(page: Page, name: string) {
  return page.getByTestId("language-switcher").getByText(name, { exact: true }).click();
}

test("one tap changes the language of a studio page, with the same address", async ({ page }) => {
  for (const path of ["/studio", "/studio/hours", "/studio/bookings"]) {
    await page.goto(path);
    const url = page.url();
    await choose(page, "Nederlands");
    await expect(page.locator("html")).toHaveAttribute("lang", "nl");
    expect(page.url()).toBe(url);
    await choose(page, "English");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(page.url()).toBe(url);
  }
  await page.goto("/studio");
  await choose(page, "Nederlands");
  await expect(page.getByText(nl.StudioHome.logOut)).toBeVisible();
  await page.screenshot({ path: "out/e2e/studio-language-nl.png" });
  await choose(page, "English");
  await expect(page.getByText(en.StudioHome.logOut)).toBeVisible();
  await page.screenshot({ path: "out/e2e/studio-language-en.png" });
});

test("a choice in the studio app stays a year and reaches the public pages", async ({ page }) => {
  await page.goto("/studio");
  await choose(page, "Nederlands");
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  const cookie = await localeCookie(page);
  expect(cookie?.value).toBe("nl");
  expect(cookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + YEAR - 3600);
  await page.goto("/");
  await expect(page).toHaveURL(/\/nl$/);
});

test("a choice on a public page stays a year", async ({ page }) => {
  await page.goto("/");
  await choose(page, "Nederlands");
  await expect(page).toHaveURL(/\/nl$/);
  await expect.poll(async () => (await localeCookie(page))?.value).toBe("nl");
  const cookie = await localeCookie(page);
  expect(cookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + YEAR - 3600);
});
