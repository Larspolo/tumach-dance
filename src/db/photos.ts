// The photos of the studio (#171, roadmap `site:photos`): the files on the data volume, a row per photo in the
// database. `sharp` makes a large and a small WebP version; it drops the EXIF data (the place and the camera).
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { type Db, DEFAULT_DATABASE_PATH } from "./index";
import { photos } from "./schema";

export type Photo = typeof photos.$inferSelect;

/** A phone photo is a few MB; a larger file is not a photo for the site. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
/** The long side of the two versions, in pixels. */
export const LARGE_PX = 1600;
export const SMALL_PX = 600;
/** The formats that a phone or a computer gives. No SVG: it is a text file, not a photo. */
const FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "tiff", "gif"]);

/** Why `addPhoto()` refused a file. The page shows a text from `messages/` for each reason. */
export class PhotoError extends Error {
  constructor(readonly reason: "too-large" | "not-image") {
    super(`photo refused: ${reason}`);
    this.name = "PhotoError";
  }
}

/** The folder of the photos: `PHOTOS_DIR`, else `photos/` next to the database (the volume of the image). */
export function photosDir(): string {
  return process.env.PHOTOS_DIR || join(dirname(process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH), "photos");
}

/** The path of one version of a photo. */
export function photoPath(dir: string, file: string, size: "large" | "small"): string {
  return join(dir, `${file}-${size}.webp`);
}

/** The photos in the order of `position`. */
export function listPhotos(db: Db): Photo[] {
  return db.select().from(photos).orderBy(asc(photos.position), asc(photos.id)).all();
}

/** Resize one version: upright by the EXIF orientation, at most `px` on the long side, WebP with no metadata. */
function resize(input: Buffer, px: number) {
  return sharp(input)
    .rotate()
    .resize({ width: px, height: px, fit: "inside", withoutEnlargement: true })
    .webp()
    .toBuffer({ resolveWithObject: true });
}

/** Store a photo as the last one. Refuse a file larger than 15 MB and a file that is not an image. */
export async function addPhoto(db: Db, dir: string, input: Buffer): Promise<Photo> {
  if (input.length > MAX_PHOTO_BYTES) throw new PhotoError("too-large");
  let large: Awaited<ReturnType<typeof resize>>;
  let small: Awaited<ReturnType<typeof resize>>;
  try {
    const { format } = await sharp(input).metadata();
    if (!FORMATS.has(format)) throw new PhotoError("not-image");
    [large, small] = await Promise.all([resize(input, LARGE_PX), resize(input, SMALL_PX)]);
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError("not-image");
  }
  const file = randomBytes(16).toString("hex");
  const paths = [photoPath(dir, file, "large"), photoPath(dir, file, "small")];
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(paths[0], large.data);
    await writeFile(paths[1], small.data);
    const { last } = db
      .select({ last: sql<number | null>`max(${photos.position})` })
      .from(photos)
      .get() ?? { last: null };
    return db
      .insert(photos)
      .values({
        file,
        width: large.info.width,
        height: large.info.height,
        position: (last ?? -1) + 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();
  } catch (error) {
    await Promise.all(paths.map((path) => rm(path, { force: true })));
    throw error;
  }
}

/** Remove a photo: the row and both files. */
export async function removePhoto(db: Db, dir: string, id: number): Promise<Photo | undefined> {
  const row = db.delete(photos).where(eq(photos.id, id)).returning().get();
  if (row) {
    await Promise.all((["large", "small"] as const).map((size) => rm(photoPath(dir, row.file, size), { force: true })));
  }
  return row;
}
