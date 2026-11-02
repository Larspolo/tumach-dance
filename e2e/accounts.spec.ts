// The footer and the contact section link the accounts of the studio (#451), and the structured data has them (#452); `playwright.config.ts` sets them.
import { expect, test } from "@playwright/test";

const INSTAGRAM = "https://www.instagram.com/tumach.test/";
const WHATSAPP = "https://wa.me/31600000000";

for (const [locale, message] of [
  ["en", "Send me a message"],
  ["nl", "Stuur me een bericht"],
] as const) {
  test(`the footer and the contact section link the accounts (${locale})`, async ({ page }, testInfo) => {
    await page.goto(`/${locale}`);
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", INSTAGRAM);
    await expect(footer.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", WHATSAPP);
    const contact = page.locator("#contact");
    await expect(contact.getByRole("link", { name: "@tumach.test" })).toHaveAttribute("href", INSTAGRAM);
    await expect(contact.getByRole("link", { name: message })).toHaveAttribute("href", WHATSAPP);
    if (locale === "en") {
      await contact.getByRole("link", { name: message }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`contact-${testInfo.project.name}.png`) });
      await footer.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`footer-${testInfo.project.name}.png`) });
    }
  });
}

for (const locale of ["en", "nl"] as const) {
  test(`the home page has the structured data with the accounts (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const text = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(text ?? "{}");
    expect(data["@type"]).toBe("DanceSchool");
    expect(data.sameAs).toEqual(expect.arrayContaining([INSTAGRAM, WHATSAPP]));
  });
}

test("the footer of another page links them too", async ({ page }) => {
  await page.goto("/en/privacy");
  await expect(page.locator("footer").getByRole("link", { name: "Instagram" })).toHaveAttribute("href", INSTAGRAM);
});
