import { expect, test } from "@playwright/test";

// The test server is the preview (SITE_ENV is not "live"): no search engine may list it (#241).
test("the preview answers /robots.txt with Disallow: /", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Disallow: /");
});
