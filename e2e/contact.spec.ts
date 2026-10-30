// The contact form of the home page on a phone and a laptop (#152): a send, and a form with errors. The emails go to
// `EMAIL_LOG_FILE` (`playwright.config.ts`).
import { existsSync, readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

const LOG = "out/e2e/email.log";
const t = en.HomePage.contact;

function contactEmails(): { to: string; text: string; replyTo?: string }[] {
  if (!existsSync(LOG)) return [];
  return readFileSync(LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((email) => email.replyTo);
}

async function shot(page: Page, name: string, project: string) {
  await page.locator("#contact").screenshot({ path: `out/screenshots/contact-${name}-${project}.png` });
}

test("a visitor sends a message and sees the thank-you text", async ({ page }, testInfo) => {
  const message = `Can I come on Sunday? (${testInfo.project.name} ${Date.now()})`;
  await page.goto("/en#contact");
  await shot(page, "before", testInfo.project.name);
  const section = page.locator("#contact");
  await section.getByLabel(t.name).fill("Ana");
  await section.getByLabel(t.email).fill("ana@example.com");
  await section.getByLabel(t.message).fill(message);
  // A send less than 3 seconds after the page is a bot (#151).
  await page.waitForTimeout(3000);
  await section.getByRole("button", { name: t.send }).click();
  await expect(section.getByText(t.thanks)).toBeVisible();
  await expect(section.getByLabel(t.name)).toHaveCount(0);
  await shot(page, "after", testInfo.project.name);
  const sent = contactEmails().filter((email) => email.text.includes(message));
  expect(sent).toHaveLength(1);
  expect(sent[0].replyTo).toBe("ana@example.com");
});

test("a form with an empty message and a bad email shows both errors and sends nothing", async ({ page }, testInfo) => {
  const before = contactEmails().length;
  await page.goto("/en#contact");
  const section = page.locator("#contact");
  await section.getByLabel(t.name).fill("Ana");
  await section.getByLabel(t.email).fill("ana.example.com");
  await section.getByRole("button", { name: t.send }).click();
  await expect(section.getByText(en.Contact.errors.email)).toBeVisible();
  await expect(section.getByText(en.Contact.errors.message)).toBeVisible();
  await expect(section.getByLabel(t.email)).toHaveAccessibleDescription(en.Contact.errors.email);
  await expect(section.getByLabel(t.name)).toHaveValue("Ana");
  await shot(page, "errors", testInfo.project.name);
  expect(contactEmails()).toHaveLength(before);
});
