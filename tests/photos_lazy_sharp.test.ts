// sharp loads only for a new photo (2026-10-31): the CPU of the home server cannot run sharp (no x86-64-v2 for the
// native binary, no SSE4.1 for the WebAssembly build). A load at the import of src/db/photos.ts stopped the start of
// the server (the backup timer) and each page that lists the photos.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

vi.mock("sharp", () => {
  throw new Error("Could not load the sharp module: Wasm SIMD unsupported");
});

test("the photos and the backup load with no sharp", async () => {
  const { openDb } = await import("../src/db");
  const { listPhotos, photosDir } = await import("../src/db/photos");
  const { backupDir } = await import("../src/lib/backup");
  expect(photosDir()).toMatch(/photos$/);
  expect(backupDir()).toMatch(/backups$/);
  expect(listPhotos(openDb(":memory:"))).toEqual([]);
});

test("a new photo gives the load error of sharp, not 'not an image'", async () => {
  const { openDb } = await import("../src/db");
  const { addPhoto, listPhotos, PhotoError } = await import("../src/db/photos");
  const db = openDb(":memory:");
  const dir = mkdtempSync(join(tmpdir(), "tumach-lazy-sharp-"));
  const result = addPhoto(db, dir, Buffer.from("a photo"));
  await expect(result).rejects.toThrow();
  await expect(result).rejects.not.toBeInstanceOf(PhotoError);
  expect(listPhotos(db)).toEqual([]);
});
