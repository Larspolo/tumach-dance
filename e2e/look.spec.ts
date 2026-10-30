import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

test("each page has the nav, the footer and the fonts of the site, with no request to Google", async ({
  page,
}, testInfo) => {
  const google: string[] = [];
  page.on("request", (request) => {
    if (/googleapis|gstatic/.test(request.url())) google.push(request.url());
  });

  await page.goto("/en");
  await expect(page.getByRole("navigation", { name: en.Nav.label }).getByRole("link")).toHaveText(`${en.Nav.logo}.`);
  const footer = page.locator("footer");
  await expect(footer).toContainText(en.Footer.domain);
  await expect(footer).toContainText(en.Footer.tagline);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 239, 230)");
  await expect(footer).toHaveCSS("background-color", "rgb(20, 18, 16)");
  expect(await page.locator("body").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Fraunces/);
  expect(await footer.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Space Mono/);
  expect(google).toEqual([]);

  await page.screenshot({ path: `out/screenshots/look-${testInfo.project.name}.png`, fullPage: true });
});

test("screenshot of the reference", async ({ page }, testInfo) => {
  await page.goto(pathToFileURL("docs/design/current-site.html").href);
  await page.screenshot({ path: `out/screenshots/reference-${testInfo.project.name}.png` });
});
