// The offers of the studio app on a phone (#31): log in with the code of the email log, add, change and hide.
import { existsSync, readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

const EMAIL_LOG = "out/e2e/email.log";

function emailCount(): number {
  return existsSync(EMAIL_LOG) ? readFileSync(EMAIL_LOG, "utf8").trim().split("\n").filter(Boolean).length : 0;
}

async function logIn(page: Page) {
  await page.goto("/studio/login");
  const before = emailCount();
  await page.getByLabel(en.StudioLogin.emailLabel).fill("nina@example.test");
  await page.getByRole("button", { name: en.StudioLogin.sendCode }).click();
  await expect.poll(emailCount).toBe(before + 1);
  const lines = readFileSync(EMAIL_LOG, "utf8").trim().split("\n");
  const code = JSON.parse(lines.at(-1) ?? "{}").text?.match(/\b\d{6}\b/)?.[0];
  await page.getByLabel(en.StudioLogin.codeLabel).fill(code ?? "");
  await page.getByRole("button", { name: en.StudioLogin.logIn }).click();
  await expect(page).toHaveURL(/\/studio$/);
}

test("without a session the offers page goes to the login page", async ({ page }) => {
  await page.goto("/studio/offers");
  await expect(page).toHaveURL(/\/studio\/login$/);
});

test("Nina adds an offer, changes its price and hides it", async ({ page }, testInfo) => {
  // The phone only; `workers: 1` keeps the logins of the files apart (a new code replaces the old one).
  test.skip(testInfo.project.name !== "phone", "the offers are for the phone");
  await logIn(page);
  await page.getByRole("link", { name: en.StudioHome.offers }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioOffers.title);

  const name = en.StudioOffers.rental.replace("{minutes}", "120");
  const offer = page.locator("details", { has: page.locator("summary", { hasText: name }) });
  const count = await offer.count();
  await page.getByText(en.StudioOffers.add, { exact: true }).click();
  await page.getByLabel(en.StudioOffers.rentalKind).check();
  const addForm = page.locator("form", {
    has: page.getByRole("button", { name: en.StudioOffers.addSave, exact: true }),
  });
  await addForm.getByLabel(en.StudioOffers.length).selectOption("120");
  await addForm.getByLabel(en.StudioOffers.price).fill("80");
  await addForm.getByRole("button", { name: en.StudioOffers.addSave, exact: true }).click();
  await expect(offer).toHaveCount(count + 1);
  const last = offer.last();
  await expect(last.locator("summary")).toContainText("€80.00");

  await last.locator("summary").click();
  await last.getByLabel(en.StudioOffers.price).fill("85,50");
  await last.getByRole("button", { name: en.StudioOffers.save }).click();
  await expect(last.locator("summary")).toContainText("€85.50");

  // The details can stay open after the save: open it only when it is closed.
  if (!(await last.evaluate((el) => (el as HTMLDetailsElement).open))) await last.locator("summary").click();
  await last.getByRole("button", { name: en.StudioOffers.hide }).click();
  await expect(last.locator("summary")).toContainText(en.StudioOffers.hidden);
  await page.screenshot({ path: "out/screenshots/studio-offers-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-offers-laptop.png", fullPage: true });
});
