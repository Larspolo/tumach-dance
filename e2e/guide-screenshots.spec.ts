// Makes the pictures of the guide for Nina (#45) in public/guide/<locale>/: `GUIDE_SCREENSHOTS=1 npx playwright test
// e2e/guide-screenshots.spec.ts --project phone`. CI skips it. A test email and a made-up code: never real data.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import sl from "../messages/sl.json" with { type: "json" };

const EMAIL = "nina@example.test";
const BROWSER_LOCALE = { en: "en-GB", nl: "nl-NL", sl: "sl-SI" };

test.skip(!process.env.GUIDE_SCREENSHOTS, "only when GUIDE_SCREENSHOTS=1");

function lastCode(): string {
  const lines = readFileSync("out/e2e/email.log", "utf8").trim().split("\n");
  return JSON.parse(lines.at(-1) ?? "{}").text?.match(/\b\d{6}\b/)?.[0] ?? "";
}

for (const [locale, m] of Object.entries({ en, nl, sl })) {
  test.describe(locale, () => {
    test.use({ locale: BROWSER_LOCALE[locale as keyof typeof BROWSER_LOCALE] });
    test(`the pictures of the guide in ${locale}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "the pictures are of a phone");
      const dir = `public/guide/${locale}`;
      await page.goto("/studio/login");
      await page.getByLabel(m.StudioLogin.emailLabel).fill(EMAIL);
      await page.screenshot({ path: `${dir}/login-email.png` });
      await page.getByRole("button", { name: m.StudioLogin.sendCode }).click();
      await page.getByLabel(m.StudioLogin.codeLabel).fill("123456");
      await page.screenshot({ path: `${dir}/login-code.png` });
      await page.getByLabel(m.StudioLogin.codeLabel).fill(lastCode());
      await page.getByRole("button", { name: m.StudioLogin.logIn }).click();
      await expect(page).toHaveURL(/\/studio$/);
      await expect(page.getByRole("button", { name: m.Push.turnOn })).toBeVisible();
      await page.screenshot({ path: `${dir}/push-off.png` });
      // The state after "Allow" (headless Chromium has no push service: LEARNINGS).
      await page.context().grantPermissions(["notifications"]);
      await page.addInitScript(() => {
        PushManager.prototype.subscribe = async () =>
          ({
            toJSON: () => ({ endpoint: "https://push.example.test/guide", keys: { p256dh: "p", auth: "a" } }),
          }) as unknown as PushSubscription;
      });
      await page.reload();
      await page.getByRole("button", { name: m.Push.turnOn }).click();
      await expect(page.getByRole("button", { name: m.Push.sendTest })).toBeVisible();
      await page.screenshot({ path: `${dir}/push-on.png` });
    });
  });
}
