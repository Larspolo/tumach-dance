// Nina adds a photo in the studio app and finds it on the home page (#297: she did not see "photos" on the site).
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import en from "../messages/en.json" with { type: "json" };
import { openDb } from "../src/db";
import { listPhotos, removePhoto } from "../src/db/photos";
import { STUDIO_SESSION } from "./studio-session";

const DB = "out/e2e/tumach.db";
const DIR = "out/e2e/photos";

async function clear() {
  const db = openDb(DB);
  for (const photo of listPhotos(db)) await removePhoto(db, DIR, photo.id);
}

test.use({ storageState: STUDIO_SESSION });
test.describe.configure({ mode: "serial" });
test.beforeAll(clear);
test.afterAll(clear);

test("a photo that Nina adds shows on the home page, with a link to it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "one upload is enough");
  await page.goto("/studio/photos");
  await expect(page.getByRole("link", { name: en.StudioPhotos.onSite })).toHaveCount(0);
  const buffer = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 90, b: 60 } } })
    .jpeg()
    .toBuffer();
  await page.getByLabel(en.StudioPhotos.choose).setInputFiles([{ name: "studio.jpg", mimeType: "image/jpeg", buffer }]);
  await page.getByRole("button", { name: en.StudioPhotos.add }).click();
  await expect(page.locator("main li img")).toHaveCount(1);
  const [file] = listPhotos(openDb(DB)).map((photo) => photo.file);

  await page.getByRole("link", { name: en.StudioPhotos.onSite }).click();
  const photo = page.locator(`#photos img[src="/photos/${file}-large.webp"]`);
  await expect(photo).toBeInViewport();
  await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: "out/screenshots/home-photos-phone.png" });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  await page.getByRole("navigation").getByRole("link", { name: en.Nav.photos }).click();
  await expect(photo).toBeInViewport();
  await page.screenshot({ path: "out/screenshots/home-photos-laptop.png" });
});
