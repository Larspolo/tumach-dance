// The photos of the studio on the home page (#174): no section with no photos, the small versions on a phone,
// `width` and `height` on each image.
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { type Db, openDb } from "../src/db";
import { addPhoto, listPhotos, type Photo, removePhoto } from "../src/db/photos";

// The database and the photo folder of the test server (`playwright.config.ts`: `photos/` next to the database).
const DIR = "out/e2e/photos";
let db: Db;
let added: Photo[] = [];

const image = (r: number, g: number, b: number) =>
  sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r, g, b } } })
    .jpeg()
    .toBuffer();

test.beforeAll(async () => {
  db = openDb("out/e2e/tumach.db");
  for (const photo of listPhotos(db)) await removePhoto(db, DIR, photo.id);
});

test.afterAll(async () => {
  for (const photo of added) await removePhoto(db, DIR, photo.id);
});

test("with no photos the home page has no photo section", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("#classes")).toBeVisible();
  await expect(page.locator("#photos")).toHaveCount(0);
});

for (const size of [
  { width: 390, height: 844, version: "small" },
  { width: 1280, height: 800, version: "large" },
] as const) {
  test(`at ${size.width} px the photos show in the ${size.version} version`, async ({ page }, testInfo) => {
    if (added.length === 0) {
      added = [await addPhoto(db, DIR, await image(190, 170, 140)), await addPhoto(db, DIR, await image(60, 70, 80))];
    }
    await page.setViewportSize({ width: size.width, height: size.height });
    const loaded: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/photos/")) loaded.push(new URL(response.url()).pathname);
    });
    await page.goto("/en");
    const images = page.locator("#photos img");
    await expect(images).toHaveCount(2);
    for (const img of await images.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect(img).toHaveAttribute("width", "1600");
      await expect(img).toHaveAttribute("height", "1200");
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    expect(loaded.length).toBeGreaterThan(0);
    const other = size.version === "small" ? "large" : "small";
    expect(
      loaded.every((path) => path.endsWith(`-${size.version}.webp`)),
      loaded.join(", "),
    ).toBe(true);
    expect(loaded.some((path) => path.endsWith(`-${other}.webp`))).toBe(false);
    await page.locator("#photos").screenshot({ path: testInfo.outputPath(`home-photos-${size.width}.png`) });
  });
}
