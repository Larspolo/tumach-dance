// #26: the passkey offer of the studio app; "Not now" stays on the device; a passkey logs in with no code.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

const EMAIL = "nina@example.test";
const EMAIL_LOG = "out/e2e/email.log";

function emailCount(): number {
  return readFileSync(EMAIL_LOG, "utf8").trim().split("\n").filter(Boolean).length;
}

// The session of `studio.setup.ts`: Better Auth limits the sign-in tries, so this test does not log in with a code.
test.use({ storageState: STUDIO_SESSION });

test("Nina adds a passkey and then logs in with it", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the login is for the phone");
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });

  // "Not now": the offer closes and does not come back on this device.
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: en.PasskeyOffer.title })).toBeVisible();
  await page.screenshot({ path: "out/screenshots/studio-passkey-offer.png", fullPage: true });
  await page.getByRole("button", { name: en.PasskeyOffer.notNow }).click();
  await expect(page.getByRole("heading", { name: en.PasskeyOffer.title })).toBeHidden();
  await page.reload();
  await expect(page.getByText(EMAIL)).toBeVisible();
  await expect(page.getByRole("heading", { name: en.PasskeyOffer.title })).toBeHidden();

  // Another device (no choice stored): the offer comes, and Nina adds a passkey.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: en.PasskeyOffer.add }).click();
  await expect(page.getByRole("heading", { name: en.PasskeyOffer.title })).toBeHidden();
  await expect(page.getByText(en.PasskeyOffer.failed)).toBeHidden();

  // No session (not a log out: that ends the shared session of the other tests); the passkey logs in with no
  // email and no code, with the same session as a code.
  await context.clearCookies();
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/studio\/login$/);
  const emails = emailCount();
  await page.getByRole("button", { name: en.StudioLogin.passkey }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByText(EMAIL)).toBeVisible();
  expect(emailCount()).toBe(emails);
  const cookie = (await context.cookies()).find((c) => c.name.endsWith("session_token"));
  expect(cookie?.httpOnly).toBe(true);
  expect((cookie?.expires ?? 0) * 1000 - Date.now()).toBeGreaterThan(179 * 24 * 60 * 60 * 1000);
  await expect(page.getByRole("heading", { name: en.PasskeyOffer.title })).toBeHidden();
});
