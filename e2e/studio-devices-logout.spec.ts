// Nina logs out another device, or all other devices, from the page of her devices (#587).
import { readFileSync } from "node:fs";
import { type Browser, expect, type Page, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

const EMAIL_LOG = "out/e2e/email.log";

function lastCode(): string | undefined {
  const lines = readFileSync(EMAIL_LOG, "utf8").trim().split("\n");
  return JSON.parse(lines.at(-1) ?? "{}").text?.match(/\b\d{6}\b/)?.[0];
}

// A second session with a new login (as studio.setup.ts); never the session of STUDIO_SESSION.
// Better Auth allows 3 codes a minute per IP address: each second device has its own address, so the
// logins of this file do not block the login of studio-login.spec.ts.
let device = 0;
async function secondDevice(browser: Browser): Promise<Page> {
  device += 1;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${device + 10 * (Date.now() % 20)}` },
  });
  const page = await context.newPage();
  await page.goto("/studio/login");
  const before = lastCode();
  await page.getByLabel(en.StudioLogin.emailLabel).fill("nina@example.test");
  await page.getByRole("button", { name: en.StudioLogin.sendCode }).click();
  await expect(page.getByLabel(en.StudioLogin.codeLabel)).toBeVisible();
  await expect.poll(() => lastCode()).not.toBe(before);
  await page.getByLabel(en.StudioLogin.codeLabel).fill(lastCode() ?? "");
  await page.getByRole("button", { name: en.StudioLogin.logIn }).click();
  await expect(page).toHaveURL(/\/studio$/);
  return page;
}

// The current device has no button; "Log out this device?" also contains the text "this device".
const others = (page: Page) => page.getByRole("listitem").filter({ has: page.getByRole("button") });

test.use({ storageState: STUDIO_SESSION, viewport: { width: 390, height: 844 } });
// One run: "all other devices" can log out the session of another spec, so the phone project only and serial.
test.describe.configure({ mode: "serial" });

test.describe("log out a device", () => {
  test.beforeEach(({ browserName: _ }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the phone project only");
  });

  test("No keeps the device, Yes logs it out", async ({ page, browser }) => {
    const second = await secondDevice(browser);
    await page.goto("/studio/devices");
    const before = await others(page).count();
    expect(before).toBeGreaterThan(0);
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasNot: page.getByRole("button") })
        .getByRole("button"),
    ).toHaveCount(0);
    const item = others(page).first();
    await item.getByRole("button", { name: en.Devices.logOut }).click();
    await expect(item.getByText(en.Devices.confirm)).toBeVisible();
    await page.screenshot({ path: "out/screenshots/studio-devices-confirm-phone.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "out/screenshots/studio-devices-confirm-laptop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await item.getByRole("button", { name: en.Devices.no }).click();
    await expect(others(page)).toHaveCount(before);
    // The newest other device is the second one (the list is newest first).
    await item.getByRole("button", { name: en.Devices.logOut }).click();
    await item.getByRole("button", { name: en.Devices.yes }).click();
    await expect(others(page)).toHaveCount(before - 1);
    await second.goto("/studio");
    await expect(second).toHaveURL(/\/studio\/login$/);
    await second.context().close();
  });

  test("log out all other devices keeps this device", async ({ page, browser }) => {
    const second = await secondDevice(browser);
    await page.goto("/studio/devices");
    await page.getByRole("button", { name: en.Devices.logOutOthers }).click();
    await page.getByRole("button", { name: en.Devices.yes }).click();
    await expect(others(page)).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasNot: page.getByRole("button") })).toHaveCount(1);
    await expect(page.getByRole("button", { name: en.Devices.logOutOthers })).toHaveCount(0);
    await second.goto("/studio");
    await expect(second).toHaveURL(/\/studio\/login$/);
    await second.context().close();
  });
});
