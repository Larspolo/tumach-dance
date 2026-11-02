// The basic security headers on each response of the site (#490) and the Content-Security-Policy (#491).
import { expect, type Page, test } from "@playwright/test";
import { STUDIO_SESSION } from "./studio-session";

const HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=31536000",
  "x-frame-options": "DENY",
};

const directives = (csp: string) => new Map(csp.split(/;\s*/).map((d) => [d.split(" ")[0], d] as const));

for (const path of ["/en", "/en/book", "/studio/login", "/api/health"]) {
  test(`${path} sends the security headers`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBeLessThan(400);
    const headers = response.headers();
    for (const [name, value] of Object.entries(HEADERS)) expect(headers[name], name).toBe(value);
    // One policy only: a second header would also apply and block the scripts with the nonce.
    expect(response.headersArray().filter((h) => h.name.toLowerCase() === "content-security-policy")).toHaveLength(1);
    const csp = directives(headers["content-security-policy"] ?? "");
    expect(csp.get("default-src")).toBe("default-src 'self'");
    expect(csp.get("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(csp.get("script-src")).toMatch(/^script-src 'self'/);
    expect(csp.get("script-src")).not.toContain("'unsafe-inline'");
    expect(csp.get("script-src")).not.toContain("'unsafe-eval'");
  });
}

/** Open a page and give the CSP errors of the console; each script of the page must have the nonce. */
async function cspErrors(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) errors.push(message.text());
  });
  const response = await page.goto(path);
  expect(response?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  const nonce = (response?.headers()["content-security-policy"] ?? "").match(/'nonce-([^']+)'/)?.[1];
  expect(nonce, "a nonce in the policy").toBeTruthy();
  const withoutNonce = await page.evaluate(() => [...document.scripts].filter((s) => !s.nonce).map((s) => s.src));
  expect(withoutNonce).toEqual([]);
  return errors;
}

for (const path of ["/en", "/en/book", "/studio/login"]) {
  test(`${path} runs its scripts with no CSP error`, async ({ page }) => {
    expect(await cspErrors(page, path)).toEqual([]);
  });
}

test.describe("the studio app", () => {
  test.use({ storageState: STUDIO_SESSION });
  for (const path of ["/studio", "/studio/photos", "/studio/week"]) {
    test(`${path} runs its scripts with no CSP error`, async ({ page }) => {
      expect(await cspErrors(page, path)).toEqual([]);
    });
  }
});
