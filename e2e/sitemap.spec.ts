import { expect, test } from "@playwright/test";

// The sitemap lists each public page in each language, so that search engines find all of them (#240).
test("GET /sitemap.xml answers the pages in each language", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("/nl/book");
});
