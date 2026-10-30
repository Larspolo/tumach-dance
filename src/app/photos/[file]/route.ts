// A stored photo of the studio (#172): one WebP version, with a long cache header. The name of each file is new, so
// it never changes. Only a name of the form of `addPhoto()`: no path out of the folder.
import { readFile } from "node:fs/promises";
import { photosDir } from "@/db/photos";

const NAME = /^([0-9a-f]{32})-(large|small)\.webp$/;

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!NAME.test(file)) return new Response(null, { status: 404 });
  let data: Buffer;
  try {
    data = await readFile(`${photosDir()}/${file}`);
  } catch {
    return new Response(null, { status: 404 });
  }
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
