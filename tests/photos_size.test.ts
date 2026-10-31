// The small photo of a phone photo is small enough for a phone to load (#214, epic #170).
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addPhoto, photoPath } from "../src/db/photos";

const tempDir = () => mkdtempSync(join(tmpdir(), "tumach-photos-size-"));

/** A noisy JPEG of 4000 x 3000 pixels: about 9 MB, like a phone photo. */
function phonePhotoJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 4000,
      height: 3000,
      channels: 3,
      background: "#806040",
      noise: { type: "gaussian", mean: 128, sigma: 60 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

test("the small version of a large phone photo is at most 200 kB and 600 px on its long side", async () => {
  const db = openDb(":memory:");
  const dir = tempDir();
  const photo = await addPhoto(db, dir, await phonePhotoJpeg());

  const path = photoPath(dir, photo.file, "small");
  const meta = await sharp(path).metadata();
  expect(statSync(path).size).toBeLessThanOrEqual(200_000);
  expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(600);
});
