// The route of the stored photos: the WebP type, the cache header, and 404 for any other name (#172).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { GET } from "../src/app/photos/[file]/route";

const name = `${"a1".repeat(16)}-small.webp`;
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tumach-photos-route-"));
  writeFileSync(join(dir, name), "webp");
  writeFileSync(join(dir, "tumach.db"), "secret");
  process.env.PHOTOS_DIR = dir;
});
afterEach(() => {
  delete process.env.PHOTOS_DIR;
});

const get = (file: string) => GET(new Request(`http://x/photos/${file}`), { params: Promise.resolve({ file }) });

test("serves a stored photo as WebP with a long cache header", async () => {
  const response = await get(name);
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/webp");
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  expect(await response.text()).toBe("webp");
});

test("gives 404 for an unknown name, a path out of the folder and a name with a slash", async () => {
  for (const file of [`${"b2".repeat(16)}-small.webp`, "../tumach.db", "tumach.db", `x/${name}`, `${name}/x`]) {
    expect((await get(file)).status).toBe(404);
  }
});
