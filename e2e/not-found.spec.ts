// An unknown address shows the not-found page in the look and the language of the site (#359).
import { expect, test } from "@playwright/test";

const CASES = [
  { path: "/en/no-such-page", locale: "en-GB", lang: "en", title: "This page is not here", book: "Book a lesson" },
  { path: "/nl/no-such-page", locale: "nl-NL", lang: "nl", title: "Deze pagina is er niet", book: "Boek een les" },
  { path: "/no-such-page", locale: "nl-NL", lang: "nl", title: "Deze pagina is er niet", book: "Boek een les" },
  { path: "/no-such-page", locale: "en-GB", lang: "en", title: "This page is not here", book: "Book a lesson" },
];

for (const c of CASES) {
  test(`${c.path} (${c.locale}) shows the not-found page`, async ({ browser }) => {
    const context = await browser.newContext({ locale: c.locale, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const response = await page.goto(c.path);
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", c.lang);
    await expect(page.getByRole("heading", { level: 1, name: c.title })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: c.book })).toHaveAttribute("href", `/${c.lang}/book`);
    await expect(page.getByRole("main").locator(`a[href="/${c.lang}"]`)).toBeVisible();
    await context.close();
  });
}
