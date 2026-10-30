// Log in to the studio app once, with the code from the email log of the test server, and store the session (#23).
import { readFileSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

const EMAIL_LOG = "out/e2e/email.log";

function lastCode(): string | undefined {
  const lines = readFileSync(EMAIL_LOG, "utf8").trim().split("\n");
  return JSON.parse(lines.at(-1) ?? "{}").text?.match(/\b\d{6}\b/)?.[0];
}

setup("log in to the studio app", async ({ page }) => {
  await page.goto("/studio/login");
  await page.getByLabel(en.StudioLogin.emailLabel).fill("nina@example.test");
  await page.getByRole("button", { name: en.StudioLogin.sendCode }).click();
  await expect(page.getByLabel(en.StudioLogin.codeLabel)).toBeVisible();
  await expect.poll(() => lastCode()).toBeTruthy();
  await page.getByLabel(en.StudioLogin.codeLabel).fill(lastCode() ?? "");
  await page.getByRole("button", { name: en.StudioLogin.logIn }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await page.context().storageState({ path: STUDIO_SESSION });
});
