// The login of the studio app on a phone (#19), with the code from the email log of the test server.
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

const EMAIL = "nina@example.test";
const EMAIL_LOG = "out/e2e/email.log";

function emailCount(): number {
  return existsSync(EMAIL_LOG) ? readFileSync(EMAIL_LOG, "utf8").trim().split("\n").filter(Boolean).length : 0;
}

function lastCode(): string | undefined {
  const lines = readFileSync(EMAIL_LOG, "utf8").trim().split("\n");
  return JSON.parse(lines.at(-1) ?? "{}").text?.match(/\b\d{6}\b/)?.[0];
}

test("Nina logs in with a code by email on her phone", async ({ page }, testInfo) => {
  // One login at a time: a new code replaces the code of the other project.
  test.skip(testInfo.project.name !== "phone", "the login is for the phone");
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/studio\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioLogin.title);

  const before = emailCount();
  await page.getByLabel(en.StudioLogin.emailLabel).fill(EMAIL);
  await page.getByRole("button", { name: en.StudioLogin.sendCode }).click();
  await expect(page.getByLabel(en.StudioLogin.codeLabel)).toBeVisible();
  await expect.poll(emailCount).toBe(before + 1);
  await page.screenshot({ path: "out/screenshots/studio-login-code.png", fullPage: true });

  await page.getByLabel(en.StudioLogin.codeLabel).fill(lastCode() === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: en.StudioLogin.logIn }).click();
  await expect(page.getByText(en.StudioLogin.wrongCode)).toBeVisible();

  await page.getByLabel(en.StudioLogin.codeLabel).fill(lastCode() ?? "");
  await page.getByRole("button", { name: en.StudioLogin.logIn }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByText(EMAIL)).toBeVisible();
  const cookie = (await page.context().cookies()).find((c) => c.name.endsWith("session_token"));
  expect(cookie?.httpOnly).toBe(true);
  expect((cookie?.expires ?? 0) * 1000 - Date.now()).toBeGreaterThan(179 * 24 * 60 * 60 * 1000);
  await page.screenshot({ path: "out/screenshots/studio-home.png", fullPage: true });

  await page.reload();
  await expect(page).toHaveURL(/\/studio$/);
});
