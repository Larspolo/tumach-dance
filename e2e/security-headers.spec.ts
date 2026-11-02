// The basic security headers on each response of the site (#490).
import { expect, test } from "@playwright/test";

const HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=31536000",
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'",
};

for (const path of ["/en", "/en/book", "/studio/login", "/api/health"]) {
  test(`${path} sends the security headers`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBeLessThan(400);
    const headers = response.headers();
    for (const [name, value] of Object.entries(HEADERS)) expect(headers[name], name).toBe(value);
  });
}
