import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

test("the manifest makes /studio an installable app with icons of the right size", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.start_url).toBe("/studio");
  expect(manifest.scope).toBe("/studio");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((icon: { purpose: string }) => icon.purpose)).toEqual(["any", "any", "maskable"]);

  for (const icon of [...manifest.icons, { src: "/icons/apple-touch-icon.png", sizes: "180x180" }]) {
    const image = await request.get(icon.src);
    expect(image.status(), icon.src).toBe(200);
    const png = await image.body();
    // The width and the height of a PNG are in its IHDR chunk, at bytes 16 and 20.
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.src).toBe(icon.sizes);
  }
});

// /studio needs a login (#19): its login page has the layout of the studio app.
test("the login page of /studio answers 200 and links the manifest", async ({ page }) => {
  const response = await page.goto("/studio/login");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioLogin.title);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
});
