// The photo page of the studio app (#173): Nina adds two photos at once, removes one with two taps, and a file that
// is not an image gives an error and stores nothing. Small test images made here.
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { listPhotos, removePhoto } from "../src/db/photos";
import { STUDIO_SESSION } from "./studio-session";

// The database and the photo folder of the test server (`playwright.config.ts`).
const DB = "out/e2e/tumach.db";
const DIR = "out/e2e/photos";

const image = async (r: number, g: number, b: number) =>
  sharp({ create: { width: 800, height: 600, channels: 3, background: { r, g, b } } })
    .jpeg()
    .toBuffer();

async function clear() {
  const db = openDb(DB);
  for (const photo of listPhotos(db)) await removePhoto(db, DIR, photo.id);
}

test.use({ storageState: STUDIO_SESSION, viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });
test.beforeAll(clear);
test.afterAll(clear);

test("Nina adds two photos at once and removes one with two taps", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the photo page is for the phone");
  await page.goto("/studio");
  await page.getByRole("link", { name: en.StudioHome.photos }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.StudioPhotos.title);
  await expect(page.getByText(en.StudioPhotos.none)).toBeVisible();

  await page.getByLabel(en.StudioPhotos.choose).setInputFiles([
    { name: "one.jpg", mimeType: "image/jpeg", buffer: await image(190, 170, 140) },
    { name: "two.jpg", mimeType: "image/jpeg", buffer: await image(60, 70, 80) },
  ]);
  await page.getByRole("button", { name: en.StudioPhotos.add }).click();
  const images = page.locator("main li img");
  await expect(images).toHaveCount(2);
  for (const img of await images.all()) {
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await page.screenshot({ path: "out/screenshots/studio-photos-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "out/screenshots/studio-photos-laptop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByText(en.StudioPhotos.remove).first().click();
  await page.getByRole("button", { name: en.StudioPhotos.removeConfirm }).click();
  await expect(images).toHaveCount(1);
  expect(listPhotos(openDb(DB))).toHaveLength(1);
});

test("a file that is not an image gives an error and stores nothing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the photo page is for the phone");
  const before = listPhotos(openDb(DB)).length;
  await page.goto("/studio/photos");
  await page
    .getByLabel(en.StudioPhotos.choose)
    .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a photo") });
  await page.getByRole("button", { name: en.StudioPhotos.add }).click();
  await expect(page.getByText(en.StudioPhotos["not-image"].replace("{name}", "notes.txt"))).toBeVisible();
  expect(listPhotos(openDb(DB))).toHaveLength(before);
});
