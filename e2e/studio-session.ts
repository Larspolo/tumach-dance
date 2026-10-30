// Log in to the studio app with the code from the email log of the test server (#19, #23).
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

export const EMAIL = "nina@example.test";
export const EMAIL_LOG = "out/e2e/email.log";

export function lastCode(): string | undefined {
  const lines = readFileSync(EMAIL_LOG, "utf8").trim().split("\n");
  return JSON.parse(lines.at(-1) ?? "{}").text?.match(/\b\d{6}\b/)?.[0];
}

export async function logIn(page: Page): Promise<void> {
  await page.goto("/studio/login");
  await page.getByLabel(en.StudioLogin.emailLabel).fill(EMAIL);
  await page.getByRole("button", { name: en.StudioLogin.sendCode }).click();
  await expect(page.getByLabel(en.StudioLogin.codeLabel)).toBeVisible();
  await expect.poll(() => lastCode()).toBeTruthy();
  await page.getByLabel(en.StudioLogin.codeLabel).fill(lastCode() ?? "");
  await page.getByRole("button", { name: en.StudioLogin.logIn }).click();
  await expect(page).toHaveURL(/\/studio$/);
}
