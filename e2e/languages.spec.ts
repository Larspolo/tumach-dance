import { expect, test } from "@playwright/test";

// The first visit to / opens the language of the browser (#41): Dutch, Slovenian, or English for any other language.
const cases = [
  { locale: "nl-NL", path: "/nl", lang: "nl" },
  { locale: "sl-SI", path: "/sl", lang: "sl" },
  { locale: "de-DE", path: "/en", lang: "en" },
];

for (const { locale, path, lang } of cases) {
  test(`a first visit in ${locale} opens ${path}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();

    await page.goto("/");
    await expect(page).toHaveURL(new URL(path, baseURL).toString());
    await expect(page.locator("html")).toHaveAttribute("lang", lang);

    await context.close();
  });
}
