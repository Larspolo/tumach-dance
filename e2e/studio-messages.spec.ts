// The contact messages in the studio app (#533) on a phone and a laptop: a visitor sends a message, Nina sees it on
// the page "Messages", answers it, and the visitor gets the answer by email (`EMAIL_LOG_FILE`, `playwright.config.ts`).
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

const LOG = "out/e2e/email.log";

function emailsTo(to: string): { to: string; subject: string; text: string; html?: string }[] {
  if (!existsSync(LOG)) return [];
  return readFileSync(LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((email) => email.to === to);
}

test("without a session the messages page goes to the login page", async ({ page }) => {
  await page.goto("/studio/messages");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test("a visitor sends a message, Nina answers it in the studio app", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const visitor = `visitor-${stamp}@example.com`;
  const message = `Is there a class on Friday? (${stamp})`;

  const home = await browser.newPage();
  await home.goto("/en#contact");
  const section = home.locator("#contact");
  await section.getByLabel(en.HomePage.contact.name).fill("Ana");
  await section.getByLabel(en.HomePage.contact.email).fill(visitor);
  await section.getByLabel(en.HomePage.contact.message).fill(message);
  // A send less than 3 seconds after the page is a bot (#151).
  await home.waitForTimeout(3000);
  await section.getByRole("button", { name: en.HomePage.contact.send }).click();
  await expect(section.getByText(en.HomePage.contact.thanks)).toBeVisible();
  await home.close();

  const context = await browser.newContext({ storageState: STUDIO_SESSION });
  const page = await context.newPage();
  await page.goto("/studio");
  await page.getByRole("link", { name: /^Messages/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioMessages.title);
  const item = page.getByRole("listitem").filter({ hasText: message });
  await expect(item.getByText(visitor)).toBeVisible();
  await page.screenshot({ path: `out/screenshots/studio-messages-${testInfo.project.name}.png`, fullPage: true });

  await item.getByLabel(en.StudioMessages.answer).fill("Yes, at 19:00. See you!");
  await item.getByRole("button", { name: en.StudioMessages.send }).click();
  await expect(page.getByText(en.StudioMessages.thanks)).toBeVisible();
  const answered = page.getByRole("listitem").filter({ hasText: message });
  await expect(answered.getByText("Yes, at 19:00. See you!")).toBeVisible();
  await expect(answered.getByLabel(en.StudioMessages.answer)).toHaveCount(0);

  const sent = emailsTo(visitor);
  expect(sent).toHaveLength(1);
  expect(sent[0].subject).toBe(en.ContactAnswer.subject);
  expect(sent[0].text).toContain("Yes, at 19:00. See you!");
  await context.close();
});
