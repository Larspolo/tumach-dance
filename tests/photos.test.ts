// The photos of the studio on the data volume (#171).
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addPhoto, listPhotos, MAX_PHOTO_BYTES, PhotoError, photoPath, removePhoto } from "../src/db/photos";

const tempDir = () => mkdtempSync(join(tmpdir(), "tumach-photos-"));

/**
 * A JPEG of 2000 x 1000 pixels (left half red, right half blue) with a camera name and the EXIF orientation 6: a
 * phone held upright. Upright, the photo is 1000 x 2000 with red at the top.
 */
function portraitJpeg(): Promise<Buffer> {
  const red = { create: { width: 1000, height: 1000, channels: 3 as const, background: "#ff0000" } };
  return sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#0000ff" } })
    .composite([{ input: red, left: 0, top: 0 }])
    .jpeg()
    .withExif({ IFD0: { Make: "TestPhone" } })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

async function pixel(path: string, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * info.channels;
  return [...data.subarray(at, at + 3)];
}

test("the test photo has the EXIF data that addPhoto() must remove", async () => {
  const meta = await sharp(await portraitJpeg()).metadata();
  expect(meta.orientation).toBe(6);
  expect(meta.exif).toBeDefined();
  expect(meta.exif?.includes("TestPhone")).toBe(true);
});

test("addPhoto() stores an upright large and small WebP with no EXIF data, and a row", async () => {
  const db = openDb(":memory:");
  const dir = join(tempDir(), "photos");
  const photo = await addPhoto(db, dir, await portraitJpeg());
  expect(photo).toMatchObject({ width: 800, height: 1600, position: 0 });
  expect(photo.file).toMatch(/^[0-9a-f]{32}$/);
  expect(readdirSync(dir).sort()).toEqual([`${photo.file}-large.webp`, `${photo.file}-small.webp`]);

  for (const [size, width, height] of [
    ["large", 800, 1600],
    ["small", 300, 600],
  ] as const) {
    const path = photoPath(dir, photo.file, size);
    const meta = await sharp(path).metadata();
    expect(meta).toMatchObject({ format: "webp", width, height });
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(readFileSync(path).includes("TestPhone")).toBe(false);
    // Red at the top, blue at the bottom: upright.
    const [r, , b] = await pixel(path, width / 2, 10);
    expect(r).toBeGreaterThan(200);
    expect(b).toBeLessThan(50);
    const [r2, , b2] = await pixel(path, width / 2, height - 10);
    expect(r2).toBeLessThan(50);
    expect(b2).toBeGreaterThan(200);
  }
});

test("a small photo is not made larger", async () => {
  const db = openDb(":memory:");
  const small = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#888" } })
    .png()
    .toBuffer();
  const photo = await addPhoto(db, tempDir(), small);
  expect(photo).toMatchObject({ width: 400, height: 300 });
});

test("listPhotos() gives the photos by position; removePhoto() removes the row and both files", async () => {
  const db = openDb(":memory:");
  const dir = tempDir();
  const jpeg = await portraitJpeg();
  const a = await addPhoto(db, dir, jpeg);
  const b = await addPhoto(db, dir, jpeg);
  expect(b.position).toBe(1);
  expect(a.file).not.toBe(b.file);
  db.$client.prepare("UPDATE photos SET position = ? WHERE id = ?").run(5, a.id);
  expect(listPhotos(db).map((p) => p.id)).toEqual([b.id, a.id]);

  expect((await removePhoto(db, dir, a.id))?.id).toBe(a.id);
  expect(listPhotos(db).map((p) => p.id)).toEqual([b.id]);
  expect(existsSync(photoPath(dir, a.file, "large"))).toBe(false);
  expect(existsSync(photoPath(dir, a.file, "small"))).toBe(false);
  expect(readdirSync(dir)).toHaveLength(2);
  expect(await removePhoto(db, dir, a.id)).toBeUndefined();
});

test("a text file, an SVG and a file of more than 15 MB give an error and store nothing", async () => {
  const db = openDb(":memory:");
  const dir = tempDir();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
  for (const [input, reason] of [
    [Buffer.from("Hello, this is not a photo."), "not-image"],
    [Buffer.from(svg), "not-image"],
    [Buffer.alloc(MAX_PHOTO_BYTES + 1), "too-large"],
  ] as const) {
    const error = await addPhoto(db, dir, input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PhotoError);
    expect((error as PhotoError).reason).toBe(reason);
  }
  expect(listPhotos(db)).toEqual([]);
  expect(readdirSync(dir)).toEqual([]);
});
